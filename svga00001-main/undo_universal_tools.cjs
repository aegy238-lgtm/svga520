const fs = require('fs');
let code = fs.readFileSync('src/components/UniversalMotionTools.tsx', 'utf-8');

// 1. Remove muteOriginalAudio state
code = code.replace(
  "const [activeViewMode, setActiveViewMode] = useState<'vap' | 'svga'>('vap');\n  const [muteOriginalAudio, setMuteOriginalAudio] = useState<boolean>(false);",
  "const [activeViewMode, setActiveViewMode] = useState<'vap' | 'svga'>('vap');"
);

// 2. Remove the effect
code = code.replace(
  `useEffect(() => {
    if (containerRef.current) {
      const videoEl = containerRef.current.querySelector('video');
      if (videoEl) {
        videoEl.muted = muteOriginalAudio;
      }
    }
  }, [muteOriginalAudio, fileUrl]);

  // Extract VAP configuration`,
  "// Extract VAP configuration"
);

// 3. Update handleAudioUpload back
code = code.replace(
  "setIsAudioMuted(false);\n    setMuteOriginalAudio(true);",
  "setIsAudioMuted(false);"
);

// 4. Increase timeout back
code = code.replace(/60\)/g, "120)");

// 5. Remove "Mute Original Audio" toggle
const originalAudioToggle = `            {/* Original VAP Audio Control */}
            <div className="p-5 border-b border-white/5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Volume2 className="w-3.5 h-3.5 text-blue-400" />
                  صوت ملف VAP الأصلي
                </span>
              </div>
              <div className="flex items-center justify-between bg-white/5 border border-white/10 rounded-2xl p-4">
                <span className="text-sm font-bold text-slate-300">كتم الصوت الأصلي</span>
                <button 
                  onClick={() => setMuteOriginalAudio(!muteOriginalAudio)}
                  className={\`w-12 h-6 rounded-full relative transition-colors \${muteOriginalAudio ? 'bg-indigo-500' : 'bg-slate-700'}\`}
                >
                  <span className={\`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform \${muteOriginalAudio ? 'left-1 translate-x-6' : 'left-1'}\`} />
                </button>
              </div>
            </div>`;
code = code.replace(originalAudioToggle + "\n            {/* 3. Background Color Switcher", "{/* 3. Background Color Switcher");

// 6. Remove "Upload another VAP file" button
const uploadButtonHTML = `                {/* Overlay Load Another File Button */}
                <div className="absolute top-4 left-4 z-10 flex gap-2"> 
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-indigo-600/80 hover:bg-indigo-500 backdrop-blur-md text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-all shadow-lg shadow-indigo-900/20 border border-indigo-400/30 flex items-center gap-2"
                  >
                    <Upload className="w-4 h-4" /> رفع ملف VAP آخر
                  </button>
                </div>`;
code = code.replace(uploadButtonHTML + "\n                  {/* Original VAP Video Canvas */}", "{/* Original VAP Video Canvas */}");

fs.writeFileSync('src/components/UniversalMotionTools.tsx', code);
console.log("Undo update_universal_tools.cjs complete");
