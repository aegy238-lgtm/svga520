const fs = require('fs');
let content = fs.readFileSync('src/components/UniversalMotionTools.tsx', 'utf8');

const oldQualityUI = `                <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-1">
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
                )}`;

const newQualityUI = `                <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-1">
                  <span>أصغر حجم (20%)</span>
                  <span>مطابق للأصلي (85%)</span>
                  <span>أعلى جودة (100%)</span>
                </div>

                {activeTooltip === 'quality' && (
                  <div className="absolute top-full left-0 right-0 mt-2 p-3 bg-[#1A1D27] border border-emerald-500/30 rounded-xl shadow-xl z-50 animate-in fade-in zoom-in duration-200">
                    <p className="text-xs text-slate-300 leading-relaxed">
                      <strong className="text-emerald-400 block mb-1">ما هو مستوى الضغط والجودة؟</strong>
                      هذا الخيار يتحكم في العلاقة بين وضوح الصورة وحجم الملف النهائي عند استخراجه كـ SVGA أو VAP.
                      <br/>- <strong className="text-red-400">إذا خفضته:</strong> سيتم تصغير مساحة الملف بشكل كبير جداً، ولكن ستنخفض جودة ألوان الصورة قليلاً.
                      <br/>- <strong className="text-indigo-300">مطابق للأصلي (85%):</strong> سيتم مطابقة حجم وضغط الملف النهائي بنفس حجم ومواصفات الملف الأساسي المرفوع تماماً (وهذا هو الخيار الافتراضي الأفضل).
                      <br/>- <strong className="text-emerald-400">إذا رفعته (100%):</strong> ستكون الجودة أقوى بكثير من الأصلي، مما قد يزيد من حجم الملف.
                    </p>
                  </div>
                )}`;

content = content.replace(oldQualityUI, newQualityUI);

fs.writeFileSync('src/components/UniversalMotionTools.tsx', content);
console.log("Quality UI updated");
