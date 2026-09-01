const fs = require('fs');

let content = fs.readFileSync('src/components/UniversalMotionTools.tsx', 'utf8');

// Add states
content = content.replace(
  "const [muteOriginalAudio, setMuteOriginalAudio] = useState<boolean>(false);",
  "const [muteOriginalAudio, setMuteOriginalAudio] = useState<boolean>(false);\n  const [isPlaying, setIsPlaying] = useState<boolean>(true);\n  const [isPlaybackMuted, setIsPlaybackMuted] = useState<boolean>(false);"
);

// Update useEffect for muting
content = content.replace(
  "videoEl.muted = muteOriginalAudio;",
  "videoEl.muted = isPlaybackMuted || muteOriginalAudio;"
);

// Add Play/Pause / Mute handlers
const importsSearch = "const handleRemoveAudio = () => {";
const newHandlers = `
  const handleTogglePlay = () => {
    setIsPlaying(prev => !prev);
    
    // Handle VAP Video
    if (activeViewMode === 'vap') {
      const videoEl = containerRef.current?.querySelector('video');
      if (videoEl) {
        if (isPlaying) {
          videoEl.pause();
        } else {
          videoEl.play();
        }
      }
    } else if (activeViewMode === 'svga') {
       if (svgaPlayerRef.current) {
         if (isPlaying) {
           svgaPlayerRef.current.pause();
         } else {
           svgaPlayerRef.current.start();
         }
       }
    }

    // Handle Custom Audio Sync
    if (audioElementRef.current && audioUrl && !isAudioMuted) {
      if (isPlaying) {
        audioElementRef.current.pause();
        setIsAudioPlaying(false);
      } else {
        audioElementRef.current.play().then(() => setIsAudioPlaying(true)).catch(() => {});
      }
    }
  };

  const handleTogglePlaybackMute = () => {
    setIsPlaybackMuted(prev => !prev);
    const videoEl = containerRef.current?.querySelector('video');
    if (videoEl) {
      videoEl.muted = !isPlaybackMuted || muteOriginalAudio;
    }
    if (audioElementRef.current) {
      audioElementRef.current.muted = !isPlaybackMuted;
    }
  };

  const handleRemoveAudio = () => {`;
content = content.replace(importsSearch, newHandlers);

// Update Audio element for custom audio
content = content.replace(
  "onEnded={() => setIsAudioPlaying(false)}\n        className=\"hidden\"\n      />",
  "onEnded={() => setIsAudioPlaying(false)}\n        className=\"hidden\"\n        muted={isPlaybackMuted}\n      />"
);

// Replace Bottom Status Pill with unified control bar
const bottomStatusPillStr = `{/* Bottom Status Pill with Audio Indicator */}
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-black/70 backdrop-blur-md px-5 py-2.5 rounded-full border border-white/10 z-20 shadow-2xl">
                  <div className="text-[11px] font-mono text-emerald-400 font-bold flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span>{activeViewMode === 'vap' ? 'VAP Real-time Player' : 'SVGA 2.0 Live Player (Clean Alpha)'}</span>
                  </div>
                  
                  <div className="h-3 w-px bg-white/20" />
                  
                  <span className="text-[10px] text-slate-400 font-mono">
                    {videoDimensions.width}×{videoDimensions.height} px
                  </span>

                  {audioUrl && (
                    <>
                      <div className="h-3 w-px bg-white/20" />
                      <div className="flex items-center gap-1.5 text-[10px] font-mono text-pink-400">
                        <Headphones className="w-3 h-3" />
                        <span>{isAudioMuted ? 'Muted' : 'Audio Synced'}</span>
                      </div>
                    </>
                  )}
                </div>`;

const newControlBar = `{/* Unified Playback Control Bar */}
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
                            <span className="text-red-400 flex items-center gap-1"><VolumeX className="w-3 h-3" /> كتم</span>
                          ) : audioUrl ? (
                            <span className="text-pink-400 flex items-center gap-1"><Headphones className="w-3 h-3" /> مدمج</span>
                          ) : null}
                        </div>
                      </>
                    )}
                  </div>
                </div>`;

content = content.replace(bottomStatusPillStr, newControlBar);

fs.writeFileSync('src/components/UniversalMotionTools.tsx', content);
console.log("Updated");
