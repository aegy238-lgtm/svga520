import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Name3DState } from './types';
import { renderCanvas } from './utils/canvasRenderer';
import { decorateText } from './utils/textDecorators';
import { Type, Palette, Box, Image as ImageIcon, Settings, Download, ZoomIn, ZoomOut, RefreshCw, Layers } from 'lucide-react';


const ColorFillEditor = ({ label, fill, onChange }: { label: string, fill: any, onChange: (f: any) => void }) => {
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        const img = new Image();
        img.onload = () => {
          onChange({ ...fill, type: 'image', image: img, imageUrl: dataUrl });
        };
        img.src = dataUrl;
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <label className="block text-sm font-bold text-indigo-300">{label}</label>
        <div className="flex bg-[#020617] rounded-lg border border-white/10 overflow-hidden">
          <button 
             onClick={() => onChange({ ...fill, type: 'color' })}
             className={`px-3 py-1 text-xs ${fill.type === 'color' ? 'bg-indigo-500 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            لون
          </button>
          <button 
             onClick={() => onChange({ ...fill, type: 'image' })}
             className={`px-3 py-1 text-xs ${fill.type === 'image' ? 'bg-indigo-500 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            صورة
          </button>
        </div>
      </div>
      
      {fill.type === 'color' && (
        <div className="flex gap-4 items-center">
          <input type="color" value={fill.color || '#ffffff'} onChange={e => onChange({ ...fill, color: e.target.value })} className="w-12 h-12 rounded-xl cursor-pointer border-0 p-0 bg-transparent" />
          <input type="text" value={fill.color || '#ffffff'} onChange={e => onChange({ ...fill, color: e.target.value })} className="flex-1 bg-[#020617] border border-white/10 rounded-xl p-3 text-sm text-center font-mono uppercase focus:border-indigo-500" />
        </div>
      )}

      {fill.type === 'image' && (
        <div className="space-y-2">
           {fill.imageUrl && (
             <div className="w-full h-24 rounded-xl border border-white/10 overflow-hidden relative group">
                <img src={fill.imageUrl} alt="Texture" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                   <label className="cursor-pointer bg-white/20 hover:bg-white/30 text-white px-3 py-1 rounded-lg text-xs backdrop-blur-md">
                     تغيير الصورة
                     <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                   </label>
                </div>
             </div>
           )}
           {!fill.imageUrl && (
             <label className="w-full h-24 border-2 border-dashed border-white/20 hover:border-indigo-500 rounded-xl flex flex-col items-center justify-center cursor-pointer bg-white/5 transition-colors">
                <ImageIcon className="w-6 h-6 text-slate-400 mb-2" />
                <span className="text-xs text-slate-400">اختر صورة للتعبئة</span>
                <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
             </label>
           )}
        </div>
      )}
    </div>
  )
}

interface Name3DEditorProps {
  onCancel?: () => void;
  currentUser?: any;
  onSubscriptionRequired?: () => void;
}

const Name3DEditor: React.FC<Name3DEditorProps> = ({ onCancel, currentUser, onSubscriptionRequired }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState<Name3DState>({
    text: 'الاسم هنا',
    fontFamily: 'Tajawal',
    fontSize: 150,
    letterSpacing: 0,
    lineHeight: 1.2,
    textAlign: 'center',
    textX: 400,
    textY: 300,
    textRotation: 0,
    frontFill: { type: 'color', color: '#ffffff' },
    sideFill: { type: 'color', color: '#6366f1' },
    depth: 30,
    depthAngle: 45,
    lightingIntensity: 0.5,
    glossiness: 0.3,
    shadow: {
      enabled: true,
      color: 'rgba(0,0,0,0.5)',
      blur: 20,
      offsetX: 10,
      offsetY: 10
    },
    ornaments: [],
    canvasWidth: 800,
    canvasHeight: 600,
    bgColor: '#1e293b',
    transparentBg: true
  });

  const [history, setHistory] = useState<Name3DState[]>([state]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<'text' | 'colors' | '3d' | 'ornaments' | 'settings'>('text');
  const [decorTab, setDecorTab] = useState<'text' | 'symbols'>('text');
  const [zoom, setZoom] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const updateState = useCallback((updates: Partial<Name3DState>) => {
    setState(prev => {
      const next = { ...prev, ...updates };
      const newHistory = history.slice(0, historyIndex + 1);
      newHistory.push(next);
      if (newHistory.length > 50) newHistory.shift();
      setHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
      return next;
    });
  }, [history, historyIndex]);

  const handleUndo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(i => i - 1);
      setState(history[historyIndex - 1]);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(i => i + 1);
      setState(history[historyIndex + 1]);
    }
  };

  useEffect(() => {
    if (canvasRef.current) {
      renderCanvas(canvasRef.current, state, state.canvasWidth, state.canvasHeight, 1);
    }
  }, [state]);

  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    const dx = (e.clientX - dragStart.x) / zoom;
    const dy = (e.clientY - dragStart.y) / zoom;
    setState(prev => ({
      ...prev,
      textX: prev.textX + dx,
      textY: prev.textY + dy
    }));
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handlePointerUp = () => {
    if (isDragging) {
      setIsDragging(false);
      updateState({}); // Trigger history save
    }
  };

  return (
    <div className="h-full flex bg-[#020617] text-white overflow-hidden">
      {/* Sidebar Controls */}
      <div className="w-80 border-l border-white/10 flex flex-col bg-[#0f172a] shadow-2xl z-10 shrink-0">
        <div className="p-4 border-b border-white/10 text-center font-black text-xl tracking-tight bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">
          مُحرّر الأسماء 3D
        </div>
        
        <div className="flex border-b border-white/10 overflow-x-auto hide-scrollbar">
          {[
            { id: 'text', icon: Type, label: 'النص' },
            { id: 'colors', icon: Palette, label: 'الألوان' },
            { id: '3d', icon: Box, label: '3D' },
            { id: 'ornaments', icon: Layers, label: 'زخارف' },
            { id: 'settings', icon: Settings, label: 'إعدادات' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 p-3 flex flex-col items-center gap-1 min-w-[60px] transition-colors ${
                activeTab === tab.id ? 'bg-indigo-500/20 text-indigo-400 border-b-2 border-indigo-500' : 'text-slate-400 hover:bg-white/5'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              <span className="text-[10px] font-bold">{tab.label}</span>
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {activeTab === 'text' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-2">النص</label>
                <textarea 
                  value={state.text} 
                  onChange={e => updateState({ text: e.target.value })}
                  className="w-full bg-[#020617] border border-white/10 rounded-xl p-3 text-white focus:border-indigo-500 transition-colors resize-none"
                  rows={3}
                  dir="auto"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-2">نوع الخط</label>
                <select 
                  value={state.fontFamily} 
                  onChange={e => updateState({ fontFamily: e.target.value })}
                  className="w-full bg-[#020617] border border-white/10 rounded-xl p-3 text-white focus:border-indigo-500"
                >
                  <option value="Tajawal">Tajawal</option>
                  <option value="Cairo">Cairo</option>
                  <option value="Amiri">Amiri</option>
                  <option value="Aref Ruqaa">Aref Ruqaa</option>
                  <option value="Reem Kufi">Reem Kufi</option>
                  <option value="Lalezar">Lalezar</option>
                  <option value="Changa">Changa</option>
                </select>
              </div>

              
              <div className="pt-4 border-t border-white/10 space-y-3">
                 <label className="block text-xs font-bold text-slate-400">زخرفة النص (اختر لتطبيق الزخرفة)</label>
                 
                 <div className="flex gap-2 mb-2 bg-[#020617] p-1 rounded-lg border border-white/10">
                    <button onClick={() => setDecorTab('text')} className={`flex-1 text-xs py-1.5 rounded-md transition-colors ${decorTab === 'text' ? 'bg-indigo-500 text-white' : 'text-slate-400 hover:text-white'}`}>
                       الخطوط النقية
                    </button>
                    <button onClick={() => setDecorTab('symbols')} className={`flex-1 text-xs py-1.5 rounded-md transition-colors ${decorTab === 'symbols' ? 'bg-indigo-500 text-white' : 'text-slate-400 hover:text-white'}`}>
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

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-2 flex justify-between">
                    <span>حجم النص</span> <span>{state.fontSize}px</span>
                  </label>
                  <input type="range" min="20" max="400" value={state.fontSize} onChange={e => updateState({ fontSize: Number(e.target.value) })} className="w-full accent-indigo-500" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-2 flex justify-between">
                    <span>التباعد بين الأحرف</span> <span>{state.letterSpacing}px</span>
                  </label>
                  <input type="range" min="-20" max="100" value={state.letterSpacing} onChange={e => updateState({ letterSpacing: Number(e.target.value) })} className="w-full accent-indigo-500" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-2 flex justify-between">
                    <span>ارتفاع السطر</span> <span>{state.lineHeight}</span>
                  </label>
                  <input type="range" min="0.5" max="3" step="0.1" value={state.lineHeight} onChange={e => updateState({ lineHeight: Number(e.target.value) })} className="w-full accent-indigo-500" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-2 flex justify-between">
                    <span>دوران النص</span> <span>{state.textRotation}°</span>
                  </label>
                  <input type="range" min="-180" max="180" value={state.textRotation} onChange={e => updateState({ textRotation: Number(e.target.value) })} className="w-full accent-indigo-500" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-2">محاذاة النص</label>
                  <div className="flex gap-2 bg-[#020617] p-1 rounded-xl border border-white/10">
                    {(['right', 'center', 'left'] as const).map(align => (
                      <button
                        key={align}
                        onClick={() => updateState({ textAlign: align })}
                        className={`flex-1 py-2 text-xs rounded-lg transition-colors ${state.textAlign === align ? 'bg-indigo-500 text-white font-bold' : 'text-slate-400 hover:text-white'}`}
                      >
                        {align === 'right' ? 'يمين' : align === 'left' ? 'يسار' : 'وسط'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'colors' && (
            <div className="space-y-6">
              <ColorFillEditor label="لون الواجهة" fill={state.frontFill} onChange={f => updateState({ frontFill: f })} />
              <div className="pt-4 border-t border-white/10">
                <ColorFillEditor label="لون الجوانب (3D)" fill={state.sideFill} onChange={f => updateState({ sideFill: f })} />
              </div>
            </div>
          )}

          {activeTab === '3d' && (
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="flex justify-between text-xs font-bold text-slate-400"><span>العمق (البروز)</span> <span>{state.depth}</span></label>
                <input type="range" min="0" max="200" value={state.depth} onChange={e => updateState({ depth: Number(e.target.value) })} className="w-full accent-indigo-500" />
              </div>
              <div className="space-y-2">
                <label className="flex justify-between text-xs font-bold text-slate-400"><span>زاوية 3D</span> <span>{state.depthAngle}°</span></label>
                <input type="range" min="0" max="360" value={state.depthAngle} onChange={e => updateState({ depthAngle: Number(e.target.value) })} className="w-full accent-indigo-500" />
              </div>
              <div className="space-y-2 pt-4 border-t border-white/10">
                <label className="flex justify-between text-xs font-bold text-slate-400"><span>شدة الإضاءة</span> <span>{Math.round(state.lightingIntensity * 100)}%</span></label>
                <input type="range" min="0" max="1" step="0.05" value={state.lightingIntensity} onChange={e => updateState({ lightingIntensity: Number(e.target.value) })} className="w-full accent-indigo-500" />
              </div>
              <div className="space-y-2">
                <label className="flex justify-between text-xs font-bold text-slate-400"><span>اللمعان (Glossiness)</span> <span>{Math.round(state.glossiness * 100)}%</span></label>
                <input type="range" min="0" max="1" step="0.05" value={state.glossiness} onChange={e => updateState({ glossiness: Number(e.target.value) })} className="w-full accent-indigo-500" />
              </div>
              <div className="space-y-4 pt-4 border-t border-white/10">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={state.shadow.enabled} onChange={e => updateState({ shadow: { ...state.shadow, enabled: e.target.checked } })} className="w-4 h-4 rounded border-white/20 bg-white/5 accent-indigo-500" />
                  <span className="text-sm font-bold text-indigo-300">تفعيل الظل</span>
                </label>
                {state.shadow.enabled && (
                  <div className="space-y-4 pl-6 border-l-2 border-indigo-500/20">
                    <div className="space-y-2">
                      <label className="flex justify-between text-xs font-bold text-slate-400"><span>ضبابية الظل</span> <span>{state.shadow.blur}px</span></label>
                      <input type="range" min="0" max="100" value={state.shadow.blur} onChange={e => updateState({ shadow: { ...state.shadow, blur: Number(e.target.value) } })} className="w-full accent-indigo-500" />
                    </div>
                    <div className="space-y-2">
                      <label className="flex justify-between text-xs font-bold text-slate-400"><span>إزاحة X</span> <span>{state.shadow.offsetX}px</span></label>
                      <input type="range" min="-100" max="100" value={state.shadow.offsetX} onChange={e => updateState({ shadow: { ...state.shadow, offsetX: Number(e.target.value) } })} className="w-full accent-indigo-500" />
                    </div>
                    <div className="space-y-2">
                      <label className="flex justify-between text-xs font-bold text-slate-400"><span>إزاحة Y</span> <span>{state.shadow.offsetY}px</span></label>
                      <input type="range" min="-100" max="100" value={state.shadow.offsetY} onChange={e => updateState({ shadow: { ...state.shadow, offsetY: Number(e.target.value) } })} className="w-full accent-indigo-500" />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

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
                          onClick={() => updateState({ ornaments: state.ornaments.filter(o => o.id !== ornament.id) })}
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

          {activeTab === 'settings' && (
            <div className="space-y-6">
              <div className="space-y-4">
                <div className="flex gap-4">
                  <div className="flex-1 space-y-2">
                    <label className="block text-xs font-bold text-slate-400">عرض التصميم</label>
                    <input type="number" value={state.canvasWidth} onChange={e => updateState({ canvasWidth: Number(e.target.value) })} className="w-full bg-[#020617] border border-white/10 rounded-xl p-3 text-white focus:border-indigo-500 text-center" />
                  </div>
                  <div className="flex-1 space-y-2">
                    <label className="block text-xs font-bold text-slate-400">ارتفاع التصميم</label>
                    <input type="number" value={state.canvasHeight} onChange={e => updateState({ canvasHeight: Number(e.target.value) })} className="w-full bg-[#020617] border border-white/10 rounded-xl p-3 text-white focus:border-indigo-500 text-center" />
                  </div>
                </div>
                <div className="pt-4 border-t border-white/10 space-y-4">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" checked={state.transparentBg} onChange={e => updateState({ transparentBg: e.target.checked })} className="w-5 h-5 rounded border-white/20 bg-white/5 accent-indigo-500" />
                    <span className="text-sm font-bold text-white">خلفية شفافة</span>
                  </label>
                  {!state.transparentBg && (
                    <div className="space-y-2 pl-8">
                      <label className="block text-xs font-bold text-slate-400">لون الخلفية</label>
                      <div className="flex gap-4 items-center">
                        <input type="color" value={state.bgColor} onChange={e => updateState({ bgColor: e.target.value })} className="w-10 h-10 rounded-xl cursor-pointer border-0 p-0 bg-transparent" />
                        <input type="text" value={state.bgColor} onChange={e => updateState({ bgColor: e.target.value })} className="flex-1 bg-[#020617] border border-white/10 rounded-xl p-2 text-sm text-center font-mono uppercase focus:border-indigo-500" />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Export Button */}
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
               renderCanvas(exportCanvas, state, state.canvasWidth * scale, state.canvasHeight * scale, scale);
               if (format === 'jpeg' && state.transparentBg) {
                   const ctx = exportCanvas.getContext('2d');
                   if (ctx) {
                       ctx.globalCompositeOperation = 'destination-over';
                       ctx.fillStyle = '#ffffff';
                       ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
                   }
               }
               const url = exportCanvas.toDataURL(`image/${format}`, 1.0);
               const a = document.createElement('a');
               a.href = url;
               a.download = `3D_Name_${Date.now()}.${format}`;
               a.click();
           }} className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-black flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20 transition-all active:scale-95">
              <Download className="w-5 h-5" /> تصدير التصميم
           </button>
        </div>
      </div>

      {/* Main Workspace */}
      <div className="flex-1 bg-slate-900 relative overflow-hidden flex flex-col">
         {/* Toolbar */}
         <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex gap-2 p-2 bg-[#020617]/80 backdrop-blur-md rounded-2xl border border-white/10 shadow-xl">
            <button onClick={() => setZoom(z => Math.min(z + 0.1, 3))} className="p-2 hover:bg-white/10 rounded-xl text-slate-300"><ZoomIn className="w-5 h-5"/></button>
            <span className="self-center text-xs font-bold w-12 text-center">{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom(z => Math.max(z - 0.1, 0.1))} className="p-2 hover:bg-white/10 rounded-xl text-slate-300"><ZoomOut className="w-5 h-5"/></button>
            <div className="w-px h-6 bg-white/10 self-center mx-2"></div>
            <button onClick={handleUndo} disabled={historyIndex === 0} className="p-2 hover:bg-white/10 rounded-xl disabled:opacity-50 text-slate-300"><RefreshCw className="w-5 h-5 rotate-180"/></button>
            <button onClick={handleRedo} disabled={historyIndex === history.length - 1} className="p-2 hover:bg-white/10 rounded-xl disabled:opacity-50 text-slate-300"><RefreshCw className="w-5 h-5"/></button>
         </div>

         {/* Canvas Container */}
         <div 
           className="flex-1 overflow-auto flex items-center justify-center bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCI+CjxyZWN0IHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCIgZmlsbD0iIzFlMjkyZSIvPgo8cmVjdCB3aWR0aD0iMTAiIGhlaWdodD0iMTAiIGZpbGw9IiMzMzQxNTUiLz4KPHJlY3QgeD0iMTAiIHk9IjEwIiB3aWR0aD0iMTAiIGhlaWdodD0iMTAiIGZpbGw9IiMzMzQxNTUiLz4KPC9zdmc+')] cursor-move"
           onPointerDown={handlePointerDown}
           onPointerMove={handlePointerMove}
           onPointerUp={handlePointerUp}
           onPointerLeave={handlePointerUp}
         >
            <div style={{ transform: `scale(${zoom})`, transformOrigin: 'center center', transition: isDragging ? 'none' : 'transform 0.2s' }}>
                <canvas 
                   ref={canvasRef}
                   className="shadow-2xl bg-white/5 border border-white/10 pointer-events-none"
                   style={{ 
                       width: state.canvasWidth, 
                       height: state.canvasHeight 
                   }}
                />
            </div>
         </div>
      </div>
    </div>
  );
};

export default Name3DEditor;
