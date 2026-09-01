const fs = require('fs');

let content = fs.readFileSync('src/components/UniversalMotionTools.tsx', 'utf8');

// We need to add state for tooltip
content = content.replace(
  "const [isPlaybackMuted, setIsPlaybackMuted] = useState<boolean>(false);",
  `const [isPlaybackMuted, setIsPlaybackMuted] = useState<boolean>(false);
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);`
);

// We need to replace the section starting with "معالجة الشفافية وإزالة السواد" to add the tooltips

const targetSectionOld = `            {/* 4. De-Blacking & Precision Alpha Settings (For SVGA & Processing) */}
            <div className="p-5 border-b border-white/5 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  معالجة الشفافية وإزالة السواد
                </span>
                <span className="text-[10px] font-black text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                  Clean Matte
                </span>
              </div>

              {/* Unmultiply Alpha Toggle (Eliminates Black Halo) */}
              <label className="flex items-start justify-between p-3.5 rounded-2xl bg-indigo-500/5 border border-indigo-500/20 cursor-pointer hover:bg-indigo-500/10 transition-all">
                <div className="flex flex-col pr-2">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                    إزالة الهالة السوداء (De-black Matte)
                  </span>
                  <span className="text-[10px] text-indigo-200/70 mt-0.5">
                    تفكيك الألوان من الخلفية السوداء المدمجة في الفيديو لضمان نقاء الشفافية والهدية 100%.
                  </span>
                </div>
                <input 
                  type="checkbox" 
                  checked={unmultiplyAlpha}
                  onChange={(e) => setUnmultiplyAlpha(e.target.checked)}
                  className="w-4 h-4 mt-0.5 accent-indigo-500 rounded cursor-pointer"
                />
              </label>

              {/* Alpha Noise Threshold */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-bold text-slate-300">
                  <span>تنقية غباش وضوضاء الشفافية:</span>
                  <span className="text-indigo-400 font-mono">{alphaThreshold}</span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="25" 
                  step="1"
                  value={alphaThreshold}
                  onChange={(e) => setAlphaThreshold(Number(e.target.value))}
                  className="w-full accent-indigo-500 h-1.5 bg-white/10 rounded-lg cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-500">
                  <span>بدون فلترة (0)</span>
                  <span>متوازن ينظف السواد (8)</span>
                  <span>قوي (25)</span>
                </div>
              </div>

              {/* Quality Slider */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-bold text-slate-300">
                  <span>مستوى الضغط والجودة (UPNG / MP4):</span>
                  <span className="text-emerald-400 font-bold">{compressionQuality}%</span>
                </div>
                <input 
                  type="range" 
                  min="20" 
                  max="100" 
                  step="5"
                  value={compressionQuality}
                  onChange={(e) => setCompressionQuality(Number(e.target.value))}
                  className="w-full accent-emerald-500 h-1.5 bg-white/10 rounded-lg cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                  <span>أصغر حجم (20%)</span>
                  <span>متوازن (85%)</span>
                  <span>أعلى جودة (100%)</span>
                </div>
              </div>
            </div>`;


const targetSectionNew = `            {/* 4. De-Blacking & Precision Alpha Settings (For SVGA & Processing) */}
            <div className="p-5 border-b border-white/5 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  معالجة الشفافية وإزالة السواد
                </span>
                <span className="text-[10px] font-black text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                  Clean Matte
                </span>
              </div>

              {/* Unmultiply Alpha Toggle (Eliminates Black Halo) */}
              <div className="relative">
                <div className="flex items-start justify-between p-3.5 rounded-2xl bg-indigo-500/5 border border-indigo-500/20 transition-all">
                  <div className="flex flex-col pr-2 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                        إزالة الهالة السوداء (De-black Matte)
                      </span>
                      <button 
                        onMouseEnter={() => setActiveTooltip('deblack')}
                        onMouseLeave={() => setActiveTooltip(null)}
                        className="text-slate-400 hover:text-indigo-400 transition-colors"
                      >
                        <HelpCircle className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <label className="cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={unmultiplyAlpha}
                      onChange={(e) => setUnmultiplyAlpha(e.target.checked)}
                      className="w-4 h-4 mt-0.5 accent-indigo-500 rounded cursor-pointer"
                    />
                  </label>
                </div>
                {activeTooltip === 'deblack' && (
                  <div className="absolute top-full left-0 right-0 mt-2 p-3 bg-[#1A1D27] border border-indigo-500/30 rounded-xl shadow-xl z-50 animate-in fade-in zoom-in duration-200">
                    <p className="text-xs text-slate-300 leading-relaxed">
                      <strong className="text-indigo-400 block mb-1">ما هي إزالة الهالة السوداء؟</strong>
                      يقوم هذا الخيار بفصل الألوان المدمجة مع الخلفية السوداء في ملف VAP الأصلي.
                      <br/>- <strong className="text-emerald-400">عند تفعيله:</strong> ستبدو أطراف الهدية (مثل الدخان أو التوهج الساطع) نظيفة جداً على أي لون خلفية (سواء كانت خلفية التطبيق بيضاء أو ملونة).
                      <br/>- <strong className="text-red-400">عند تعطيله:</strong> قد تلاحظ ظهور حواف سوداء مزعجة أو "هالة داكنة" حول الهدية المضيئة خاصة إذا تم تشغيلها على خلفية فاتحة.
                    </p>
                  </div>
                )}
              </div>

              {/* Alpha Noise Threshold */}
              <div className="relative space-y-1.5 p-3.5 rounded-2xl bg-white/5 border border-white/5">
                <div className="flex justify-between items-center text-xs font-bold text-slate-300">
                  <div className="flex items-center gap-2">
                    <span>تنقية غباش وضوضاء الشفافية</span>
                    <button 
                      onMouseEnter={() => setActiveTooltip('alphaThreshold')}
                      onMouseLeave={() => setActiveTooltip(null)}
                      className="text-slate-400 hover:text-indigo-400 transition-colors"
                    >
                      <HelpCircle className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <span className="text-indigo-400 font-mono">{alphaThreshold}</span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="25" 
                  step="1"
                  value={alphaThreshold}
                  onChange={(e) => setAlphaThreshold(Number(e.target.value))}
                  className="w-full accent-indigo-500 h-1.5 bg-white/10 rounded-lg cursor-pointer mt-2"
                />
                <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                  <span>بدون فلترة (0)</span>
                  <span>متوازن ينظف السواد (8)</span>
                  <span>قوي (25)</span>
                </div>
                
                {activeTooltip === 'alphaThreshold' && (
                  <div className="absolute top-full left-0 right-0 mt-2 p-3 bg-[#1A1D27] border border-indigo-500/30 rounded-xl shadow-xl z-50 animate-in fade-in zoom-in duration-200">
                    <p className="text-xs text-slate-300 leading-relaxed">
                      <strong className="text-indigo-400 block mb-1">ما هي تنقية غباش الشفافية؟</strong>
                      أحياناً تحتوي الفيديوهات على بيكسلات شبه شفافة داكنة تظهر كغباش حول الأطراف. هذا المؤشر يحدد مدى قوة إزالة هذه البيكسلات الضعيفة.
                      <br/>- <strong className="text-emerald-400">إذا رفعته (قوي):</strong> سيقوم بمسح ومحو أي ضباب خفيف حول الهدية ويجعل الحواف حادة جداً. ممتاز لو الهدية فيها سواد زايد، لكن قد يمسح تفاصيل الدخان أو التوهج الخفيف.
                      <br/>- <strong className="text-amber-400">إذا خفضته (بدون فلترة):</strong> سيحافظ على كل تفاصيل التوهج والضباب الأصلية للهدية، ولكن قد تظهر بعض البقع الداكنة الخفيفة. 
                      <br/>- <strong className="text-indigo-300">المتوازن (8 إلى 12):</strong> هو الأفضل للغالبية العظمى من الهدايا.
                    </p>
                  </div>
                )}
              </div>

              {/* Quality Slider */}
              <div className="relative space-y-1.5 p-3.5 rounded-2xl bg-white/5 border border-white/5">
                <div className="flex justify-between items-center text-xs font-bold text-slate-300">
                  <div className="flex items-center gap-2">
                    <span>مستوى الضغط والجودة (UPNG / MP4)</span>
                    <button 
                      onMouseEnter={() => setActiveTooltip('quality')}
                      onMouseLeave={() => setActiveTooltip(null)}
                      className="text-slate-400 hover:text-emerald-400 transition-colors"
                    >
                      <HelpCircle className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <span className="text-emerald-400 font-bold">{compressionQuality}%</span>
                </div>
                <input 
                  type="range" 
                  min="20" 
                  max="100" 
                  step="5"
                  value={compressionQuality}
                  onChange={(e) => setCompressionQuality(Number(e.target.value))}
                  className="w-full accent-emerald-500 h-1.5 bg-white/10 rounded-lg cursor-pointer mt-2"
                />
                <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-1">
                  <span>أصغر حجم (20%)</span>
                  <span>متوازن (85%)</span>
                  <span>أعلى جودة (100%)</span>
                </div>

                {activeTooltip === 'quality' && (
                  <div className="absolute top-full left-0 right-0 mt-2 p-3 bg-[#1A1D27] border border-emerald-500/30 rounded-xl shadow-xl z-50 animate-in fade-in zoom-in duration-200">
                    <p className="text-xs text-slate-300 leading-relaxed">
                      <strong className="text-emerald-400 block mb-1">ما هو مستوى الضغط والجودة؟</strong>
                      هذا الخيار يتحكم في العلاقة بين وضوح الصورة وحجم الملف النهائي عند استخراجه كـ SVGA أو VAP.
                      <br/>- <strong className="text-red-400">إذا خفضته (أصغر حجم):</strong> سيتم تصغير مساحة الملف بشكل كبير جداً لسهولة وسرعة رفعه في التطبيقات، ولكن ستنخفض جودة ألوان الصورة قليلاً وقد تظهر بها بعض البكسلة.
                      <br/>- <strong className="text-emerald-400">إذا رفعته (100% أعلى جودة):</strong> ستكون دقة الهدية مطابقة للأصلية نقية جداً بألوان حادة، ولكن حجم الملف سيكون كبيراً.
                      <br/>- <strong className="text-indigo-300">متوازن (85%):</strong> يعطيك جودة ممتازة للعين المجردة مع حجم ملف صغير ومناسب لمعظم التطبيقات.
                    </p>
                  </div>
                )}
              </div>
            </div>`;

content = content.replace(targetSectionOld, targetSectionNew);

// Ensure HelpCircle icon is imported
if (!content.includes("HelpCircle")) {
    content = content.replace(
      "Layers, FolderOpen, Activity",
      "Layers, FolderOpen, Activity, HelpCircle"
    );
}

fs.writeFileSync('src/components/UniversalMotionTools.tsx', content);
console.log("Tooltips added");
