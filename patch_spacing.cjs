const fs = require('fs');
let code = fs.readFileSync('src/components/Name3DEditor/utils/canvasRenderer.ts', 'utf8');

code = code.replace(
  "ctx.textAlign = state.textAlign;",
  "ctx.textAlign = state.textAlign;\n  (ctx as any).letterSpacing = \`\${state.letterSpacing}px\`;"
);

fs.writeFileSync('src/components/Name3DEditor/utils/canvasRenderer.ts', code);

let uiCode = fs.readFileSync('src/components/Name3DEditor/Name3DEditor.tsx', 'utf8');
uiCode = uiCode.replace(
  "<div>\n                    <label className=\"block text-xs font-bold text-slate-400 mb-2\">حجم النص ({state.fontSize}px)</label>\n                    <input type=\"range\" min=\"20\" max=\"400\" value={state.fontSize} onChange={e => updateState({ fontSize: Number(e.target.value) })} className=\"w-full accent-indigo-500\" />\n                  </div>",
  "<div>\n                    <label className=\"block text-xs font-bold text-slate-400 mb-2\">حجم النص ({state.fontSize}px)</label>\n                    <input type=\"range\" min=\"20\" max=\"400\" value={state.fontSize} onChange={e => updateState({ fontSize: Number(e.target.value) })} className=\"w-full accent-indigo-500\" />\n                  </div>\n                  <div>\n                    <label className=\"block text-xs font-bold text-slate-400 mb-2\">التباعد بين الأحرف ({state.letterSpacing}px)</label>\n                    <input type=\"range\" min=\"-20\" max=\"100\" value={state.letterSpacing} onChange={e => updateState({ letterSpacing: Number(e.target.value) })} className=\"w-full accent-indigo-500\" />\n                  </div>"
);

fs.writeFileSync('src/components/Name3DEditor/Name3DEditor.tsx', uiCode);
