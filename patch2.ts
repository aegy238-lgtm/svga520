import { readFileSync, writeFileSync } from 'fs';

const file = 'src/components/Workspace.tsx';
let content = readFileSync(file, 'utf8');

const target2 = `          <div
            onDragOver={handleDragOverSvga}
            onDrop={handleDropSvgaFile}
            className="relative flex items-center justify-center w-full overflow-hidden rounded-2xl sm:rounded-[3rem] border border-white/10 shadow-3xl bg-black/20 transition-colors duration-200 hover:bg-black/30"
            style={{ height: \`\${Math.max(200, videoHeight * scale)}px\` }}
          >
            <div
              ref={containerRef}
              className="absolute inset-0 flex items-center justify-center transition-transform duration-500 ease-out origin-center pointer-events-none"
              style={{ transform: \`scale(\${scale})\` }}
            >
              <div
                className="relative overflow-hidden shadow-2xl pointer-events-auto"`;

const replacement2 = `          <div
            ref={wrapperRef}
            onDragOver={handleDragOverSvga}
            onDrop={handleDropSvgaFile}
            onPointerDown={handleZoomPointerDown}
            onPointerMove={handleZoomPointerMove}
            onPointerUp={handleZoomPointerUp}
            onPointerLeave={handleZoomPointerUp}
            className="relative flex items-center justify-center w-full overflow-hidden rounded-2xl sm:rounded-[3rem] border border-white/10 shadow-3xl bg-black/20 transition-colors duration-200 hover:bg-black/30 touch-none select-none"
            style={{ 
              height: \`\${Math.max(200, videoHeight * scale)}px\`,
              cursor: isPanning ? 'grabbing' : (zoomLevel !== 'fit' ? 'grab' : 'default')
            }}
          >
            {/* Zoom Controls Overlay */}
            <div className="absolute left-4 bottom-4 z-50 flex flex-col gap-2 pointer-events-auto" dir="ltr">
              <AnimatePresence>
                {showZoomMenu && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="flex flex-col bg-slate-900/90 backdrop-blur-md border border-white/10 rounded-xl p-2 shadow-2xl min-w-[180px]"
                  >
                    <div className="px-3 py-2 mb-1 rounded-lg border border-white/5 bg-black/30 flex items-center justify-between">
                       <span className="text-white font-bold text-xs">{(zoomLevel === 'fit' ? Math.round(scale * 100) : Math.round((zoomLevel as number) * 100))}%</span>
                    </div>
                    
                    <button onClick={() => handleZoomChange(0.1)} className="w-full flex items-center justify-between gap-4 px-3 py-2 text-xs font-medium text-slate-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
                      <span>Zoom In</span>
                      <span className="text-[10px] text-slate-500">Ctrl+</span>
                    </button>
                    <button onClick={() => handleZoomChange(-0.1)} className="w-full flex items-center justify-between gap-4 px-3 py-2 text-xs font-medium text-slate-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
                      <span>Zoom Out</span>
                      <span className="text-[10px] text-slate-500">Ctrl-</span>
                    </button>
                    <button onClick={() => { setZoomLevel('fit'); setPanPos({x:0, y:0}); setShowZoomMenu(false); }} className="w-full flex items-center justify-between gap-4 px-3 py-2 text-xs font-medium text-slate-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
                      <span>Fit Window</span>
                      <span className="text-[10px] text-slate-500">Shift 1</span>
                    </button>
                    
                    <div className="h-px bg-white/10 my-1 mx-2"></div>
                    
                    <button onClick={() => { setZoomLevel(0.5); setPanPos({x:0, y:0}); setShowZoomMenu(false); }} className="w-full text-left px-3 py-2 text-xs font-medium text-slate-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors">50%</button>
                    <button onClick={() => { setZoomLevel(1); setPanPos({x:0, y:0}); setShowZoomMenu(false); }} className="w-full flex items-center justify-between gap-4 px-3 py-2 text-xs font-medium text-slate-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
                      <span>100%</span>
                      <span className="text-[10px] text-slate-500">Ctrl 0</span>
                    </button>
                    <button onClick={() => { setZoomLevel(2); setPanPos({x:0, y:0}); setShowZoomMenu(false); }} className="w-full text-left px-3 py-2 text-xs font-medium text-slate-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors">200%</button>
                  </motion.div>
                )}
              </AnimatePresence>
              <button 
                onClick={() => setShowZoomMenu(!showZoomMenu)}
                className="flex items-center gap-2 px-4 py-2 bg-slate-900/80 hover:bg-slate-800 backdrop-blur-sm border border-white/10 rounded-lg text-slate-300 hover:text-white transition-colors text-xs font-bold"
              >
                {(zoomLevel === 'fit' ? Math.round(scale * 100) : Math.round((zoomLevel as number) * 100))}%
                <svg className={\`w-3 h-3 transition-transform \${showZoomMenu ? 'rotate-180' : ''}\`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7"></path></svg>
              </button>
            </div>

            <div
              className={\`absolute inset-0 flex items-center justify-center origin-center pointer-events-none \${isPanning ? '' : 'transition-transform duration-200 ease-out'}\`}
              style={{ transform: \`translate(\${panPos.x}px, \${panPos.y}px) scale(\${zoomLevel === 'fit' ? scale : zoomLevel})\` }}
            >
              <div
                ref={containerRef}
                className="relative overflow-hidden shadow-2xl pointer-events-auto"`;

const regex2 = /[\s]*<div[\s]*onDragOver=\{handleDragOverSvga\}[\s]*onDrop=\{handleDropSvgaFile\}[\s]*className="relative flex items-center justify-center w-full overflow-hidden rounded-2xl sm:rounded-\[3rem\] border border-white\/10 shadow-3xl bg-black\/20 transition-colors duration-200 hover:bg-black\/30"[\s]*style=\{\{ height: `\$\{Math.max\(200, videoHeight \* scale\)\}px` \}\}[\s]*>[\s]*<div[\s]*ref=\{containerRef\}[\s]*className="absolute inset-0 flex items-center justify-center transition-transform duration-500 ease-out origin-center pointer-events-none"[\s]*style=\{\{ transform: `scale\(\$\{scale\}\)` \}\}[\s]*>[\s]*<div[\s]*className="relative overflow-hidden shadow-2xl pointer-events-auto"/;

if(regex2.test(content)) {
   content = content.replace(regex2, replacement2);
   writeFileSync(file, content);
   console.log("Success");
} else {
   console.log("Target 2 not found");
}
