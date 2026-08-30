const fs = require('fs');

let code = fs.readFileSync('src/components/Name3DEditor/Name3DEditor.tsx', 'utf8');

// 1. Add import for decorateText
code = code.replace(
    "import { renderCanvas } from './utils/canvasRenderer';",
    "import { renderCanvas } from './utils/canvasRenderer';\nimport { decorateText } from './utils/textDecorators';"
);

// 2. Add ColorFillEditor component right before the Name3DEditor component
const colorFillEditorCode = `
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
             className={\`px-3 py-1 text-xs \${fill.type === 'color' ? 'bg-indigo-500 text-white' : 'text-slate-400 hover:text-white'}\`}
          >
            لون
          </button>
          <button 
             onClick={() => onChange({ ...fill, type: 'image' })}
             className={\`px-3 py-1 text-xs \${fill.type === 'image' ? 'bg-indigo-500 text-white' : 'text-slate-400 hover:text-white'}\`}
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

`;

code = code.replace(
    "const Name3DEditor: React.FC = () => {",
    colorFillEditorCode + "const Name3DEditor: React.FC = () => {"
);

// 3. Add text decoration UI
// Find the activeTab === 'text' block
const textDecorationsCode = `
              <div className="pt-4 border-t border-white/10">
                <label className="block text-xs font-bold text-slate-400 mb-2">زخرفة النص (اختر لتطبيق الزخرفة)</label>
                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto hide-scrollbar">
                   {decorateText(state.text).map((dec, idx) => (
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
`;

code = code.replace(
    /<\/select>\s*<\/div>\s*<div className="space-y-4">/,
    `</select>\n              </div>\n${textDecorationsCode}\n              <div className="space-y-4">`
);

// 4. Update the activeTab === 'colors' block
code = code.replace(
    /<div className="space-y-3">\s*<label className="block text-sm font-bold text-indigo-300">لون الواجهة<\/label>\s*<div className="flex gap-4 items-center">\s*<input type="color" value={state\.frontFill\.color}.*?\/>\s*<input type="text" value={state\.frontFill\.color}.*?\/>\s*<\/div>\s*<\/div>/g,
    `<ColorFillEditor label="لون الواجهة" fill={state.frontFill} onChange={f => updateState({ frontFill: f })} />`
);

code = code.replace(
    /<div className="space-y-3 pt-4 border-t border-white\/10">\s*<label className="block text-sm font-bold text-indigo-300">لون الجوانب \(3D\)<\/label>\s*<div className="flex gap-4 items-center">\s*<input type="color" value={state\.sideFill\.color}.*?\/>\s*<input type="text" value={state\.sideFill\.color}.*?\/>\s*<\/div>\s*<\/div>/g,
    `<div className="pt-4 border-t border-white/10">\n                <ColorFillEditor label="لون الجوانب (3D)" fill={state.sideFill} onChange={f => updateState({ sideFill: f })} />\n              </div>`
);


fs.writeFileSync('src/components/Name3DEditor/Name3DEditor.tsx', code);
