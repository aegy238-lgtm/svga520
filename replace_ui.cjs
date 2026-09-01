const fs = require('fs');

const filePath = 'src/components/UniversalMotionTools.tsx';
const fileContent = fs.readFileSync(filePath, 'utf8');

// Find the start of the return statement
const returnIndex = fileContent.lastIndexOf('  return (');

if (returnIndex === -1) {
  console.error("Could not find the return statement");
  process.exit(1);
}

const beforeReturn = fileContent.substring(0, returnIndex);

const newReturn = `  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#000000] sm:p-4 md:p-6 lg:p-8" dir="rtl">
      {/* Hidden Audio Element for Live Sync without interrupting VAP */}
      <audio 
        ref={audioElementRef}
        src={audioUrl || undefined}
        loop
        onEnded={() => setIsAudioPlaying(false)}
        className="hidden"
      />
      <div className="absolute inset-0 bg-[#05060A]/95 backdrop-blur-3xl" onClick={onCancel}></div>

      <div className="relative w-full max-w-[1600px] h-full sm:h-[90vh] bg-[#0B0D14] rounded-[1.5rem] sm:rounded-[2.5rem] border border-white/5 shadow-2xl flex flex-col overflow-hidden">
        
        {/* Sleek Header */}
        <header className="h-16 lg:h-20 shrink-0 bg-[#0F111A]/80 backdrop-blur-xl border-b border-white/5 flex items-center justify-between px-4 sm:px-8 z-20">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center border border-indigo-500/30 shadow-lg shadow-indigo-500/10">
              <Layers className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h2 className="text-sm sm:text-lg font-black text-white tracking-wide flex items-center gap-2">
                استوديو VAP & SVGA <span className="px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 text-[10px] uppercase border border-indigo-500/20">Pro</span>
              </h2>
              <p className="text-[10px] sm:text-xs text-slate-400 font-medium mt-0.5">محرك متقدم لمعالجة الشفافية، دمج الصوت، والتصدير</p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            {fileUrl && (
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-3 sm:px-5 py-2 sm:py-2.5 bg-white/5 hover:bg-white/10 text-white text-xs sm:text-sm font-bold rounded-xl transition-all border border-white/10 shadow-lg hover:shadow-white/5"
              >
                <FolderOpen className="w-4 h-4 text-indigo-400" />
                <span className="hidden sm:inline">استدعاء ملف آخر</span>
              </button>
            )}
            <button 
              onClick={onCancel}
              className="w-10 h-10 flex items-center justify-center bg-white/5 hover:bg-red-500/20 text-slate-400 hover:text-red-400 rounded-xl transition-all border border-white/5 hover:border-red-500/30"
              title="إغلاق"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Main Workspace */}
        <main className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
          
          {/* Left Sidebar (Settings) - RTL means it appears on Right usually, but with dir="rtl" flex-row places it logically */}
          <aside className="w-full lg:w-[420px] xl:w-[460px] bg-[#0C0E15] border-l border-white/5 overflow-y-auto custom-scrollbar flex flex-col shrink-0 z-10">
            {!fileUrl ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                <div className="w-20 h-20 bg-indigo-500/10 rounded-full flex items-center justify-center mb-6 border border-indigo-500/20">
                  <Upload className="w-8 h-8 text-indigo-400" />
                </div>
                <h3 className="text-lg font-black text-white mb-2">استوديو الحركة</h3>
                <p className="text-xs text-slate-400 leading-relaxed mb-6">قم برفع ملف MP4 (VAP) لبدء التعديل. يمكنك تغيير الخلفية، إزالة السواد، ودمج الصوت باحترافية.</p>
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-bold text-sm shadow-lg shadow-indigo-600/20 border border-indigo-500/30 transition-all flex items-center justify-center gap-2"
                >
                  <Upload className="w-4 h-4" />
                  <span>اختر ملف الفيديو للبدء</span>
                </button>
              </div>
            ) : (
              <div className="p-4 sm:p-6 space-y-6">
                
                {/* File Info Card */}
                <div className="bg-[#12141D] rounded-2xl border border-white/5 p-4 shadow-lg">
                  <div className="flex items-center gap-2 mb-4">
                    <FileVideo className="w-4 h-4 text-indigo-400" />
                    <h3 className="text-sm font-black text-white">معلومات الملف</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-[#0C0E15] p-3 rounded-xl border border-white/5">
                      <p className="text-[10px] text-slate-500 font-medium mb-1">اسم الملف</p>
                      <p className="text-xs font-bold text-slate-200 truncate" title={fileName}>{fileName}</p>
                    </div>
                    <div className="bg-[#0C0E15] p-3 rounded-xl border border-white/5">
                      <p className="text-[10px] text-slate-500 font-medium mb-1">الحجم</p>
                      <p className="text-xs font-bold text-slate-200">{fileSize}</p>
                    </div>
                    <div className="bg-[#0C0E15] p-3 rounded-xl border border-white/5">
                      <p className="text-[10px] text-slate-500 font-medium mb-1">الأبعاد</p>
                      <p className="text-xs font-bold text-slate-200">{videoDimensions.width}x{videoDimensions.height}</p>
                    </div>
                    <div className="bg-[#0C0E15] p-3 rounded-xl border border-white/5">
                      <p className="text-[10px] text-slate-500 font-medium mb-1">معدل الإطارات (FPS)</p>
                      <p className="text-xs font-bold text-slate-200">{targetFps}</p>
                    </div>
                  </div>
                </div>

                {/* Audio Engine Card */}
                <div className="bg-[#12141D] rounded-2xl border border-pink-500/10 p-4 shadow-lg relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-pink-500/50 to-purple-500/50" />
                  <div className="flex items-center gap-2 mb-4">
                    <Music className="w-4 h-4 text-pink-400" />
                    <h3 className="text-sm font-black text-white">المحرك الصوتي</h3>
                  </div>

                  <div className="space-y-4">
                    {/* Original Audio Toggle */}
                    <div className="flex items-center justify-between bg-[#0C0E15] border border-white/5 rounded-xl p-3">
                      <div className="flex items-center gap-2">
                        <VolumeX className={\`w-4 h-4 \${muteOriginalAudio ? 'text-red-400' : 'text-slate-500'}\`} />
                        <span className="text-xs font-bold text-slate-300">حذف الصوت الأصلي من الـ VAP</span>
                      </div>
                      <button 
                        onClick={() => setMuteOriginalAudio(!muteOriginalAudio)}
                        className={\`w-10 h-5 rounded-full relative transition-colors \${muteOriginalAudio ? 'bg-red-500' : 'bg-slate-700'}\`}
                      >
                        <span className={\`absolute top-1 w-3 h-3 rounded-full bg-white transition-transform \${muteOriginalAudio ? 'left-1 translate-x-5' : 'left-1'}\`} />
                      </button>
                    </div>

                    {/* Custom Audio Track */}
                    {!audioUrl ? (
                      <button 
                        onClick={() => audioInputRef.current?.click()}
                        className="w-full py-4 px-4 bg-pink-500/5 hover:bg-pink-500/10 border border-dashed border-pink-500/20 rounded-xl transition-all flex flex-col items-center justify-center gap-2 group"
                      >
                        <div className="w-8 h-8 rounded-full bg-pink-500/20 flex items-center justify-center text-pink-400 group-hover:scale-110 transition-transform">
                          <Plus className="w-4 h-4" />
                        </div>
                        <span className="text-xs font-bold text-pink-300">إضافة مسار صوتي مخصص (MP3/WAV)</span>
                        <span className="text-[10px] text-pink-500/60">لن يختفي التشغيل أثناء الإضافة!</span>
                      </button>
                    ) : (
                      <div className="bg-[#0C0E15] border border-pink-500/20 rounded-xl p-3 shadow-inner">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2 overflow-hidden pr-2">
                            <div className="w-8 h-8 rounded-lg bg-pink-500/20 flex items-center justify-center shrink-0">
                              <FileAudio className="w-4 h-4 text-pink-400" />
                            </div>
                            <div className="overflow-hidden">
                              <p className="text-xs font-bold text-white truncate" title={audioName}>{audioName}</p>
                              <p className="text-[10px] text-pink-400/80 font-mono mt-0.5">{audioDuration.toFixed(1)}s • {audioSize}</p>
                            </div>
                          </div>
                          <button 
                            onClick={handleRemoveAudio}
                            className="w-7 h-7 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 flex items-center justify-center shrink-0 transition-all border border-red-500/20"
                            title="حذف المسار الصوتي"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        
                        {/* Audio Controls */}
                        <div className="flex items-center gap-3 bg-black/40 rounded-lg p-2 border border-white/5">
                          <button
                            onClick={handleTogglePlayAudio}
                            className="w-7 h-7 rounded-md bg-pink-500 hover:bg-pink-400 text-white flex items-center justify-center transition-all shadow-lg shadow-pink-500/20 shrink-0"
                          >
                            {isAudioPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3 ml-0.5" />}
                          </button>
                          <div className="flex items-center gap-2 flex-1">
                            <Volume2 className="w-3.5 h-3.5 text-slate-400" />
                            <input 
                              type="range" min="0" max="1" step="0.05"
                              value={audioVolume}
                              onChange={(e) => handleVolumeChange(Number(e.target.value))}
                              className="w-full h-1 bg-white/10 rounded-full appearance-none accent-pink-500 cursor-pointer"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Transparency & Processing Card */}
                <div className="bg-[#12141D] rounded-2xl border border-white/5 p-4 shadow-lg">
                  <div className="flex items-center gap-2 mb-4">
                    <Sparkles className="w-4 h-4 text-emerald-400" />
                    <h3 className="text-sm font-black text-white">معالجة الشفافية والمظهر</h3>
                  </div>
                  
                  <div className="space-y-5">
                    {/* De-black Matte */}
                    <div className="space-y-2 border border-emerald-500/20 rounded-xl p-3 bg-emerald-500/5">
                      <div className="flex items-center justify-between">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input 
                            type="checkbox"
                            checked={unmultiplyAlpha}
                            onChange={(e) => setUnmultiplyAlpha(e.target.checked)}
                            className="w-4 h-4 rounded text-emerald-500 focus:ring-emerald-500 bg-[#0C0E15] border-white/20"
                          />
                          <span className="text-xs font-bold text-emerald-300">إزالة الهالة السوداء (De-black Matte)</span>
                        </label>
                      </div>
                      <p className="text-[10px] text-emerald-500/70 leading-relaxed pr-6">مهم جداً: قم بتفعيل هذا الخيار لتنظيف حواف الشفافية والتخلص من الألوان الداكنة المزعجة الناتجة عن دمج خلفيات سوداء.</p>
                      
                      {unmultiplyAlpha && (
                        <div className="pt-2">
                          <div className="flex justify-between items-end mb-1">
                            <label className="text-[10px] font-bold text-slate-400">قوة كشف السواد (Threshold)</label>
                            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">{alphaThreshold}</span>
                          </div>
                          <input 
                            type="range" min="0" max="50" step="1"
                            value={alphaThreshold}
                            onChange={(e) => setAlphaThreshold(Number(e.target.value))}
                            className="w-full h-1.5 bg-white/10 rounded-full appearance-none accent-emerald-500 cursor-pointer"
                          />
                        </div>
                      )}
                    </div>

                    {/* Background Tester */}
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">اختبار الشفافية على الخلفيات</label>
                      <div className="grid grid-cols-5 gap-1.5">
                        {presetColors.map((preset) => (
                          <button
                            key={preset.value}
                            onClick={() => {
                              if (preset.isChecker) { setBgMode('checker'); }
                              else { setBgMode('color'); setBgColor(preset.value); }
                            }}
                            title={preset.name}
                            className={\`h-8 rounded-lg border transition-all flex items-center justify-center relative overflow-hidden \${
                              (preset.isChecker && bgMode === 'checker') || (!preset.isChecker && bgMode === 'color' && bgColor.toLowerCase() === preset.value.toLowerCase())
                                ? 'border-indigo-400 ring-2 ring-indigo-500/40 shadow-lg scale-105 z-10'
                                : 'border-white/10 hover:border-white/20'
                            }\`}
                            style={{ backgroundColor: preset.isChecker ? '#1a1c23' : preset.value }}
                          >
                            {preset.isChecker && <div className="absolute inset-0 pattern-checkered opacity-60" />}
                            {((preset.isChecker && bgMode === 'checker') || (!preset.isChecker && bgMode === 'color' && bgColor.toLowerCase() === preset.value.toLowerCase())) && (
                              <Check className={\`w-3.5 h-3.5 z-10 \${preset.value === '#FFFFFF' ? 'text-black' : 'text-white'}\`} />
                            )}
                          </button>
                        ))}
                        <button
                          onClick={() => { customColorInputRef.current?.click(); setBgMode('color'); }}
                          className="h-8 rounded-lg bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 border border-white/20 flex items-center justify-center hover:scale-105 transition-transform"
                          title="لون مخصص"
                        >
                          <Palette className="w-3 h-3 text-white" />
                          <input 
                            type="color" ref={customColorInputRef}
                            value={bgMode === 'color' ? bgColor : '#000000'}
                            onChange={(e) => setBgColor(e.target.value)}
                            className="absolute opacity-0 w-full h-full cursor-pointer"
                          />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Export Card */}
                <div className="bg-gradient-to-b from-[#12141D] to-[#0C0E15] rounded-2xl border border-indigo-500/20 p-4 shadow-xl">
                  <div className="flex items-center gap-2 mb-4">
                    <Download className="w-4 h-4 text-indigo-400" />
                    <h3 className="text-sm font-black text-white">إعدادات التصدير</h3>
                  </div>

                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-2 p-1 bg-black/40 rounded-xl border border-white/5">
                      <button 
                        onClick={() => setExportTargetFormat('svga')}
                        className={\`py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 \${exportTargetFormat === 'svga' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}\`}
                      >
                        <ShieldCheck className="w-3.5 h-3.5" /> SVGA 2.0
                      </button>
                      <button 
                        onClick={() => setExportTargetFormat('vap')}
                        className={\`py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 \${exportTargetFormat === 'vap' ? 'bg-purple-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}\`}
                      >
                        <Film className="w-3.5 h-3.5" /> VAP (MP4)
                      </button>
                    </div>

                    <button 
                      onClick={handleStartExport}
                      disabled={isExporting}
                      className={\`w-full py-4 rounded-xl font-black text-sm flex items-center justify-center gap-2 transition-all shadow-xl \${
                        isExporting 
                          ? 'bg-slate-800 text-slate-400 border border-white/10 cursor-not-allowed'
                          : exportTargetFormat === 'svga'
                            ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 hover:to-indigo-400 text-white border border-indigo-400/30 hover:scale-[1.02]'
                            : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:to-pink-500 text-white border border-purple-400/30 hover:scale-[1.02]'
                      }\`}
                    >
                      {isExporting ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          <span>جاري التصدير...</span>
                        </>
                      ) : (
                        <>
                          <Activity className="w-5 h-5" />
                          <span>
                            تصدير بصيغة {exportTargetFormat === 'svga' ? 'SVGA 2.0 النقي' : 'VAP (MP4) المدمج'}
                          </span>
                        </>
                      )}
                    </button>

                    {/* Progress Bar */}
                    {isExporting && (
                      <div className="space-y-2">
                        <div className="flex justify-between items-center text-[10px] font-bold text-indigo-300">
                          <span>{exportStatusText}</span>
                          <span>{exportProgress}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-black/50 rounded-full overflow-hidden border border-white/5">
                          <div 
                            className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-full transition-all duration-300 relative"
                            style={{ width: \`\${exportProgress}%\` }}
                          >
                            <div className="absolute inset-0 bg-white/20 animate-pulse" />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

              </div>
            )}
          </aside>

          {/* Right Preview Area (Center Canvas visually) */}
          <section className="flex-1 relative bg-[#05060A] flex flex-col items-center justify-center overflow-hidden p-4 sm:p-8">
            <div className="absolute inset-0 pattern-grid-lg opacity-[0.02] pointer-events-none" />
            <div className="absolute inset-0 bg-gradient-to-b from-[#0B0D14]/50 to-transparent pointer-events-none" />

            <input type="file" ref={fileInputRef} className="hidden" accept=".mp4,.vap" onChange={handleFileSelect} />
            <input type="file" ref={audioInputRef} className="hidden" accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac" onChange={handleAudioUpload} />

            {fileUrl ? (
              <div 
                className="relative w-full h-full max-w-4xl max-h-[85vh] flex flex-col items-center justify-center rounded-[2rem] border border-white/10 overflow-hidden shadow-2xl transition-colors duration-500 ease-in-out"
                style={{ backgroundColor: bgMode === 'color' ? bgColor : '#000000' }}
              >
                {/* Background Checker */}
                {bgMode === 'checker' && (
                  <div className="absolute inset-0 pattern-checkered opacity-[0.15] pointer-events-none" />
                )}

                {/* View Switcher Overlay */}
                {exportedBlob && exportTargetFormat === 'svga' && (
                  <div className="absolute top-6 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-black/60 backdrop-blur-xl p-1.5 rounded-2xl border border-white/10 z-30 shadow-2xl">
                    <button
                      onClick={() => setActiveViewMode('vap')}
                      className={\`px-5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 \${
                        activeViewMode === 'vap' ? 'bg-white text-black shadow-md' : 'text-slate-400 hover:text-white'
                      }\`}
                    >
                      <Film className="w-3.5 h-3.5" /> الأصل (VAP)
                    </button>
                    <button
                      onClick={() => setActiveViewMode('svga')}
                      className={\`px-5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 \${
                        activeViewMode === 'svga' ? 'bg-emerald-500 text-black shadow-md' : 'text-slate-400 hover:text-white'
                      }\`}
                    >
                      <Sparkles className="w-3.5 h-3.5" /> النتيجة (SVGA)
                    </button>
                  </div>
                )}

                {/* Container for VAP (Realtime Canvas) */}
                <div 
                  id="anim-container" 
                  ref={containerRef}
                  style={{ display: activeViewMode === 'vap' ? 'flex' : 'none' }}
                  className="relative z-10 w-full h-full items-center justify-center p-4 drop-shadow-2xl"
                >
                  <style>{\`
                    #anim-container canvas { 
                      max-width: 100% !important; 
                      max-height: 100% !important; 
                      object-fit: contain; 
                      border-radius: 1rem;
                    }
                  \`}</style>
                </div>

                {/* Container for SVGA (Exported Review) */}
                <div 
                  ref={svgaContainerRef}
                  style={{ display: activeViewMode === 'svga' ? 'flex' : 'none' }}
                  className="relative z-10 w-full h-full items-center justify-center p-4 drop-shadow-2xl"
                />

                {/* Bottom Status & Audio Info Overlay */}
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-[#0A0B10]/90 backdrop-blur-xl px-6 py-3 rounded-full border border-white/10 z-20 shadow-2xl">
                  <div className="flex items-center gap-2">
                    <span className={\`w-2 h-2 rounded-full animate-pulse \${activeViewMode === 'vap' ? 'bg-indigo-400' : 'bg-emerald-400'}\`} />
                    <span className="text-xs font-black text-white tracking-wide">
                      {activeViewMode === 'vap' ? 'VAP Engine' : 'SVGA Result'}
                    </span>
                  </div>
                  
                  <div className="w-px h-4 bg-white/20" />
                  
                  <span className="text-[11px] font-mono text-slate-400">
                    {videoDimensions.width} × {videoDimensions.height}
                  </span>

                  {(audioUrl || muteOriginalAudio) && (
                    <>
                      <div className="w-px h-4 bg-white/20" />
                      <div className="flex items-center gap-1.5">
                        {muteOriginalAudio && !audioUrl && (
                          <span className="text-[10px] font-bold text-red-400 flex items-center gap-1">
                            <VolumeX className="w-3 h-3" /> صامت
                          </span>
                        )}
                        {audioUrl && (
                          <span className="text-[10px] font-bold text-pink-400 flex items-center gap-1">
                            <Music className="w-3 h-3 animate-pulse" /> تم الدمج
                          </span>
                        )}
                      </div>
                    </>
                  )}
                </div>

              </div>
            ) : (
              <div className="text-center opacity-50 flex flex-col items-center">
                <Layers className="w-16 h-16 text-slate-700 mb-4" />
                <p className="text-slate-500 font-bold text-lg">منطقة العرض</p>
              </div>
            )}
          </section>

        </main>
      </div>
    </div>
  );
};

export default UniversalMotionTools;
`;

const updatedContent = beforeReturn + newReturn;

fs.writeFileSync(filePath, updatedContent, 'utf8');
console.log("Successfully replaced the render block!");
