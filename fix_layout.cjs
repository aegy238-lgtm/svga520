const fs = require('fs');

let content = fs.readFileSync('src/components/UniversalMotionTools.tsx', 'utf8');

const oldStructure = `                {/* Unified Playback Control Bar */}
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col sm:flex-row items-center gap-3 bg-black/80 backdrop-blur-xl px-4 py-2 sm:px-6 sm:py-3 rounded-[2rem] sm:rounded-full border border-white/10 z-20 shadow-2xl transition-all">
                  
                  {/* Play/Pause & Mute Controls */}
                  <div className="flex items-center gap-2 sm:gap-3">
                    <button
                      onClick={handleTogglePlay}
                      className="w-10 h-10 sm:w-12 sm:h-12 bg-white text-black hover:bg-slate-200 rounded-full flex items-center justify-center transition-all shadow-lg hover:scale-105"
                      title={isPlaying ? "إيقاف التشغيل" : "تشغيل"}
                    >
                      {isPlaying ? <Pause className="w-5 h-5 sm:w-6 sm:h-6" /> : <Play className="w-5 h-5 sm:w-6 sm:h-6 ml-1" />}
                    </button>
                    
                    <button
                      onClick={handleTogglePlaybackMute}
                      className={\`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center transition-all border shadow-lg hover:scale-105 \${
                        isPlaybackMuted 
                          ? 'bg-red-500/20 text-red-400 border-red-500/30' 
                          : 'bg-white/10 text-white hover:bg-white/20 border-white/10'
                      }\`}
                      title={isPlaybackMuted ? "إلغاء كتم الصوت أثناء العرض" : "كتم الصوت أثناء العرض"}
                    >
                      {isPlaybackMuted ? <VolumeX className="w-5 h-5 sm:w-5 sm:h-5" /> : <Volume2 className="w-5 h-5 sm:w-5 sm:h-5" />}
                    </button>
                  </div>

                  <div className="hidden sm:block h-8 w-px bg-white/20" />
                  
                  {/* Status Indicators */}
                  <div className="flex items-center gap-3 bg-white/5 rounded-full px-4 py-2 border border-white/5">
                    <div className="text-[10px] sm:text-[11px] font-mono font-bold flex items-center gap-2">
                      <span className={\`w-2 h-2 rounded-full animate-pulse \${activeViewMode === 'vap' ? 'bg-indigo-400' : 'bg-emerald-400'}\`} />
                      <span className={activeViewMode === 'vap' ? 'text-indigo-400' : 'text-emerald-400'}>
                        {activeViewMode === 'vap' ? 'VAP Real-time' : 'SVGA Live'}
                      </span>
                    </div>
                    
                    <div className="h-3 w-px bg-white/20" />
                    
                    <span className="text-[10px] sm:text-[11px] text-slate-300 font-mono">
                      {videoDimensions.width}×{videoDimensions.height} px
                    </span>

                    {(audioUrl || muteOriginalAudio) && (
                      <>
                        <div className="h-3 w-px bg-white/20" />
                        <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] font-mono">
                          {isPlaybackMuted || (muteOriginalAudio && !audioUrl) ? (
                            <span className="text-red-400 flex items-center gap-1"><VolumeX className="w-3 h-3" /> صامت</span>
                          ) : audioUrl ? (
                            <span className="text-pink-400 flex items-center gap-1"><Headphones className="w-3 h-3" /> مدمج</span>
                          ) : null}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>`;

const newStructure = `              </div>

              {/* Unified Playback Control Bar (Moved outside the canvas) */}
              <div className="mt-6 flex flex-col sm:flex-row items-center gap-4 bg-[#141824] px-6 py-4 rounded-[2rem] border border-white/5 shadow-xl transition-all w-full max-w-3xl">
                
                {/* Play/Pause & Mute Controls */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleTogglePlay}
                    className="w-12 h-12 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full flex items-center justify-center transition-all shadow-lg hover:scale-105 shadow-indigo-600/20"
                    title={isPlaying ? "إيقاف التشغيل" : "تشغيل"}
                  >
                    {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-1" />}
                  </button>
                  
                  <button
                    onClick={handleTogglePlaybackMute}
                    className={\`w-12 h-12 rounded-full flex items-center justify-center transition-all border shadow-lg hover:scale-105 \${
                      isPlaybackMuted 
                        ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' 
                        : 'bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white border-white/10'
                    }\`}
                    title={isPlaybackMuted ? "إلغاء كتم الصوت أثناء العرض" : "كتم الصوت أثناء العرض"}
                  >
                    {isPlaybackMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                  </button>
                </div>

                <div className="hidden sm:block h-10 w-px bg-white/10 mx-2" />
                
                {/* Status Indicators */}
                <div className="flex flex-1 flex-wrap items-center justify-center sm:justify-start gap-4">
                  <div className="flex items-center gap-2 bg-[#0C0E14] px-4 py-2 rounded-xl border border-white/5">
                    <span className={\`w-2 h-2 rounded-full animate-pulse \${activeViewMode === 'vap' ? 'bg-indigo-400' : 'bg-emerald-400'}\`} />
                    <span className={\`text-xs font-bold \${activeViewMode === 'vap' ? 'text-indigo-400' : 'text-emerald-400'}\`}>
                      {activeViewMode === 'vap' ? 'VAP Real-time' : 'SVGA Live'}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2 bg-[#0C0E14] px-4 py-2 rounded-xl border border-white/5">
                    <span className="text-xs text-slate-300 font-mono">
                      {videoDimensions.width} × {videoDimensions.height} px
                    </span>
                  </div>

                  {(audioUrl || muteOriginalAudio) && (
                    <div className="flex items-center gap-2 bg-[#0C0E14] px-4 py-2 rounded-xl border border-white/5">
                      <div className="flex items-center gap-1.5 text-xs font-bold">
                        {isPlaybackMuted || (muteOriginalAudio && !audioUrl) ? (
                          <span className="text-amber-400 flex items-center gap-1.5"><VolumeX className="w-3.5 h-3.5" /> العرض صامت</span>
                        ) : audioUrl ? (
                          <span className="text-pink-400 flex items-center gap-1.5"><Headphones className="w-3.5 h-3.5" /> الصوت مدمج ويعمل</span>
                        ) : null}
                      </div>
                    </div>
                  )}
                </div>
              </div>`;

content = content.replace(oldStructure, newStructure);

// Update outer container to not obscure things and adjust height
content = content.replace(
  '<div className="flex-1 bg-[#090A0F] relative flex flex-col items-center justify-center p-4 sm:p-8 overflow-hidden">',
  '<div className="flex-1 bg-[#090A0F] relative flex flex-col items-center justify-center p-4 sm:p-6 overflow-hidden">'
);

fs.writeFileSync('src/components/UniversalMotionTools.tsx', content);
console.log("Layout updated");
