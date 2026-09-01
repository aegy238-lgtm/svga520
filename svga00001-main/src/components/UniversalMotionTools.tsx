import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Upload, Download, Music, Image as ImageIcon, Box, ZoomIn, ZoomOut, Maximize, Play, Pause, RefreshCw, Layers } from 'lucide-react';
import { UserRecord } from '../types';
import SVGAPlayer from './SVGAPlayer';
import { VapPlayer } from './VapPlayer';

interface UniversalMotionToolsProps {
  currentUser: UserRecord | null;
  onCancel: () => void;
  onLoginRequired: () => void;
  onSubscriptionRequired: () => void;
}

export const UniversalMotionTools: React.FC<UniversalMotionToolsProps> = ({
  currentUser,
  onCancel,
  onLoginRequired,
  onSubscriptionRequired
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [fileUrl, setFileUrl] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState<'Motion' | 'Image' | 'Docs'>('Motion');
  
  const [fileInfo, setFileInfo] = useState({
    format: '',
    version: '-',
    dimensions: '-',
    duration: '-',
    size: '-',
    fps: '-',
    name: ''
  });

  const [convertFormat, setConvertFormat] = useState('VAP 1.0.5');
  const [alphaMode, setAlphaMode] = useState<'none'|'right'|'left'|'bottom'|'top'>('right');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const availableFormats = [
    'SVGA 2.0', 'SVGA 2.0 EX', 'AE Project', 'SVGA → Animated SVG',
    'Lottie (Sequence)', 'Image Sequence', 'GIF (Animation)', 'APNG (Animation)',
    'WebM (Video)', 'WebP (Animated)', 'VAP (MP4)', 'VAP 1.0.5', 'SVGA → YYEVA'
  ];

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const dropped = e.dataTransfer.files[0];
    if (dropped) processFile(dropped);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) processFile(selected);
  };

  const processFile = (f: File) => {
    setFile(f);
    const url = URL.createObjectURL(f);
    setFileUrl(url);
    
    // Naive file info extraction for now
    let type = f.type || 'Unknown';
    if (f.name.toLowerCase().endsWith('.svga')) type = 'SVGA';
    else if (f.name.toLowerCase().endsWith('.mp4')) {
        type = 'MP4';
        // Auto-detect common side-by-side alpha by checking if it's VAP
        if (f.name.toLowerCase().includes('vap') || f.name.toLowerCase().includes('yyeva')) {
            setAlphaMode('right');
        } else {
            setAlphaMode('none');
        }
    }
    else if (f.name.toLowerCase().endsWith('.json')) type = 'Lottie';

    setFileInfo({
      format: type,
      version: '1.0',
      dimensions: '800 x 600 px',
      duration: '0.00 s',
      size: (f.size / (1024 * 1024)).toFixed(2) + ' MB',
      fps: '30 FPS',
      name: f.name
    });
  };

  const handleStartConversion = () => {
    if (!currentUser) {
      onLoginRequired();
      return;
    }
    setIsProcessing(true);
    // Dummy simulate
    setTimeout(() => {
      setIsProcessing(false);
      alert('تم استلام الملف وجاري تطوير محرك التحويل الموحد لهذه الأداة.');
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-[#0E0F14] text-white flex flex-col font-sans overflow-hidden">
      {/* Navbar */}
      <nav className="flex items-center justify-between px-6 py-4 bg-[#0E0F14]/80 backdrop-blur-md border-b justify-center items-center relative z-20" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
        <div className="absolute pl-4 flex items-center gap-2 cursor-pointer transition select-none hover:opacity-80" onClick={onCancel} style={{left:0}}>
          <div className="w-8 h-8 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-600/20">
            <RefreshCw className="w-4 h-4 text-white" />
          </div>
          <span className="font-black text-xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60">MotionTools</span>
        </div>
        
        <div className="flex-1 flex justify-center gap-8">
          <button onClick={() => setActiveTab('Motion')} className={`text-sm font-bold transition-colors ${activeTab === 'Motion' ? 'text-white' : 'text-slate-500 hover:text-slate-300'}`}>Motion</button>
          <button onClick={() => setActiveTab('Image')} className={`text-sm font-bold transition-colors ${activeTab === 'Image' ? 'text-white' : 'text-slate-500 hover:text-slate-300'}`}>Image</button>
          <button onClick={() => setActiveTab('Docs')} className={`text-sm font-bold transition-colors ${activeTab === 'Docs' ? 'text-white' : 'text-slate-500 hover:text-slate-300'}`}>Docs</button>
        </div>

        <div className="absolute pr-4 flex items-center gap-4" style={{right:0}}>
           <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center cursor-pointer">
              <span className="text-xs">👤</span>
           </div>
        </div>
      </nav>

      <div className="flex-1 overflow-auto flex">
        {!file ? (
          // Uploader Area
          <div className="flex-1 flex flex-col items-center justify-center relative px-4 z-10 w-full h-full">
             {/* Background decorative dots */}
             <div className="absolute inset-0 pointer-events-none opacity-20" style={{ backgroundImage: 'radial-gradient(circle at center, #ffffff 1px, transparent 1px)', backgroundSize: '50px 50px' }}></div>
             
             <motion.div 
               initial={{ opacity: 0, y: 20 }}
               animate={{ opacity: 1, y: 0 }}
               className="relative z-10 flex flex-col items-center max-w-4xl w-full"
             >
                <div className="flex flex-wrap justify-center gap-2 mb-8 items-center text-[10px] sm:text-xs">
                  {['PAG', 'SVGA', 'Lottie', 'VAP', 'YYEVA', 'Dual Channel', 'GIF', 'WebP', 'MP4', 'MKV', 'Image Sequence', '.ZIP'].map(tag => (
                    <span key={tag} className="px-3 py-1 rounded bg-slate-800/80 text-sky-400 font-mono border border-slate-700/50 shadow-inner">
                      {tag}
                    </span>
                  ))}
                </div>
                
                <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-white text-center mb-4 tracking-tight drop-shadow-2xl">Start Processing Your Animation</h1>
                <p className="text-lg md:text-xl text-slate-400 text-center mb-16 shadow-black drop-shadow-md font-arabic" dir="rtl">
                   ارفع ملف (فيديو أو أنيميشن) للمعاينة الشفافة باستخدام معالج كارت الشاشة، وضغطه أو تحويله!
                </p>
                
                <div 
                   onDragOver={(e) => e.preventDefault()}
                   onDrop={handleFileDrop}
                   onClick={() => fileInputRef.current?.click()}
                   className="w-48 h-48 md:w-64 md:h-64 rounded-full border border-purple-500/30 flex items-center justify-center cursor-pointer hover:bg-purple-900/10 transition group z-20 relative"
                >
                   <div className="w-24 h-24 md:w-32 md:h-32 rounded-full bg-gradient-to-tr from-purple-800 to-fuchsia-600 flex items-center justify-center group-hover:scale-105 transition-transform duration-300 shadow-[0_0_50px_-10px_rgba(192,38,211,0.5)] border border-white/10 pointer-events-none">
                      <Upload className="w-10 h-10 md:w-16 md:h-16 text-white/90 drop-shadow-md group-hover:-translate-y-2 transition-transform duration-300" />
                   </div>
                </div>
                <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" />
             </motion.div>
          </div>
        ) : (
          // Workspace Area
          <div className="flex-1 flex w-full relative h-[calc(100vh-70px)]">
            {/* Left Col - Player */}
            <div className="flex-1 flex flex-col bg-[#14151B] relative border-r border-[#ffffff0a] overflow-hidden">
               <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
                 <button className="flex items-center gap-2 px-4 py-2 bg-slate-800/80 rounded border border-white/5 hover:bg-slate-700 transition">
                   <Download className="w-4 h-4" /> Download
                 </button>
               </div>
               
               <div className="absolute top-4 right-4 z-10 hidden sm:flex items-center gap-2 opacity-70 hover:opacity-100 transition-opacity">
                  <span className="text-[10px] text-slate-300 bg-black/60 px-3 py-1.5 rounded-full backdrop-blur-md border border-white/10 shadow-lg font-bold">
                     Drop a new file here to switch
                  </span>
               </div>
               
               <div className="flex-1 flex mt-16 mb-16 relative p-4 pointer-events-none">
                 {/* Canvas/Preview Area */}
                 <div className="flex-1 flex items-center justify-center rounded-xl bg-transparent overflow-hidden shadow-2xl relative pointer-events-auto group" 
                      style={{ backgroundImage: 'linear-gradient(45deg, #181a20 25%, transparent 25%), linear-gradient(-45deg, #181a20 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #181a20 75%), linear-gradient(-45deg, transparent 75%, #181a20 75%)', backgroundSize: '30px 30px', backgroundPosition: '0 0, 0 15px, 15px -15px, -15px 0px' }}>
                    
                    {fileInfo.format === 'SVGA' ? (
                       <SVGAPlayer data={fileUrl} className="w-[80%] h-[80%]" />
                    ) : (fileInfo.format === 'MP4' || fileInfo.format === 'WebM' || fileInfo.format.startsWith('video')) ? (
                       alphaMode === 'none' ? (
                         <video src={fileUrl} controls autoPlay loop className="w-[80%] h-[80%] object-contain shadow-2xl rounded mx-auto" />
                       ) : (
                         <VapPlayer src={fileUrl} width={800} height={800} className="w-[80%] h-[80%]" alphaMode={alphaMode} />
                       )
                    ) : fileInfo.format.includes('image') ? (
                       <img src={fileUrl} className="max-w-[80%] max-h-[80%] object-contain" />
                    ) : (
                       <div className="text-slate-400 flex flex-col items-center">
                           <Box className="w-16 h-16 mb-4 opacity-50" />
                           <p>File loaded: {fileInfo.name}</p>
                           <p className="text-xs mt-2 text-indigo-400">Target format unsupported for direct preview.</p>
                       </div>
                    )}
                    
                    <div className="absolute top-2 left-2 bg-black/50 backdrop-blur-md border border-white/10 px-3 py-1 rounded text-[10px] font-mono text-emerald-400 opacity-50 group-hover:opacity-100 transition-opacity">
                      Hardware Acceleration: Active (GPU Rendering)
                    </div>
                 </div>
               </div>

               {/* Bottom Controls */}
               <div className="w-full h-16 bg-[#1A1C23] border-t border-white/5 flex items-center px-6 justify-between shrink-0">
                  <div className="flex items-center gap-4 bg-black/20 rounded px-2 py-1">
                     <button className="p-1 hover:text-white text-slate-400"><ZoomOut className="w-4 h-4" /></button>
                     <span className="text-xs font-mono w-12 text-center">100%</span>
                     <button className="p-1 hover:text-white text-slate-400"><ZoomIn className="w-4 h-4" /></button>
                  </div>
               </div>
            </div>

            {/* Right Col - Sidebar Settings */}
            <div className="w-[380px] bg-[#0E0F14] overflow-y-auto hidden md:block border-l border-white/5">
              <div className="p-6 space-y-8">
                 
                 {/* Animation Info */}
                 <div>
                    <h3 className="text-white font-bold mb-4 text-sm tracking-wide">Animation Info</h3>
                    <div className="space-y-3 text-xs bg-[#1A1C23] p-4 rounded-lg border border-white/5">
                        <div className="grid grid-cols-2 gap-4">
                           <div className="flex items-center gap-2 text-slate-300">
                             <span className="font-bold whitespace-nowrap">Format:</span>
                             <span className="text-sky-400 font-mono truncate">{fileInfo.format}</span>
                           </div>
                           <div className="flex items-center gap-2 text-slate-300">
                             <span className="font-bold whitespace-nowrap">Version:</span>
                             <span className="truncate">{fileInfo.version}</span>
                           </div>
                        </div>
                        <div className="flex items-center justify-between text-slate-300">
                           <span className="font-bold w-1/4">Dimensions:</span>
                           <span className="w-3/4 truncate text-right">{fileInfo.dimensions}</span>
                        </div>
                        <div className="flex items-center justify-between text-slate-300">
                           <span className="font-bold w-1/4">File Size:</span>
                           <span className="w-3/4 text-right truncate">{fileInfo.size}</span>
                        </div>
                        <div className="flex items-center text-slate-300 pt-2 border-t border-white/10 mt-2">
                           <span className="font-bold shrink-0 mr-2">File Name:</span>
                           <span className="text-[10px] text-slate-400 truncate break-all overflow-hidden relative group">
                              <span className="truncate block">{fileInfo.name}</span>
                           </span>
                        </div>
                    </div>
                 </div>
                 
                 {/* Preview Configuration */}
                 {(fileInfo.format === 'MP4' || fileInfo.format === 'WebM' || fileInfo.format.startsWith('video')) && (
                   <div className="animate-in fade-in slide-in-from-top-4 duration-300">
                      <h3 className="text-white font-bold mb-4 text-sm tracking-wide">Player Rendering (WebGL)</h3>
                      <div className="space-y-4 bg-[#1A1C23] p-4 rounded-lg border border-indigo-500/20 text-xs">
                          <p className="text-indigo-400 font-medium mb-2 font-arabic" dir="rtl">تحديد مكان قناة الشفافية لعزل الخلفية عبر كارت الشاشة (GPU):</p>
                          <select 
                            value={alphaMode}
                            onChange={(e) => setAlphaMode(e.target.value as any)}
                            className="w-full bg-[#0E0F14] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 cursor-pointer appearance-none"
                            style={{backgroundImage: 'url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23ffffff%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.7rem top 50%', backgroundSize: '0.65rem auto'}}
                          >
                             <option value="none">فيديو عادي (Opaque)</option>
                             <option value="right">ألفا (يمين الشاشة) - RGB (يسار)</option>
                             <option value="left">ألفا (يسار الشاشة) - RGB (يمين)</option>
                             <option value="bottom">ألفا (أسفل الشاشة) - RGB (أعلى)</option>
                             <option value="top">ألفا (أعلى الشاشة) - RGB (أسفل)</option>
                          </select>
                      </div>
                   </div>
                 )}

                 {/* Animation Edit */}
                 <div>
                    <h3 className="text-white font-bold mb-4 text-sm tracking-wide">Output Format Edit</h3>
                    <div className="space-y-4 bg-[#1A1C23] p-4 rounded-lg border border-white/5">
                        <div className="flex flex-col gap-2">
                           <span className="text-xs text-slate-300 font-medium">Format Conversion</span>
                           <select 
                             value={convertFormat}
                             onChange={(e) => setConvertFormat(e.target.value)}
                             className="w-full bg-[#0E0F14] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500 cursor-pointer appearance-none"
                             style={{backgroundImage: 'url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23ffffff%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.7rem top 50%', backgroundSize: '0.65rem auto'}}
                           >
                              {availableFormats.map(fmt => (
                                <option key={fmt} value={fmt}>{fmt}</option>
                              ))}
                           </select>
                        </div>
                        
                        <div className="flex items-center justify-between">
                           <span className="text-xs text-slate-300 font-medium">Compression Quality</span>
                           <input type="number" defaultValue="15" className="bg-[#0E0F14] border border-white/10 rounded px-2 py-1 text-xs text-white w-16 text-center focus:outline-none focus:border-sky-500" />
                        </div>
                    </div>
                 </div>

                 {/* Conditional VAP Config */}
                 {(convertFormat.includes('VAP') || convertFormat.includes('MP4')) && (
                    <div className="animate-in fade-in slide-in-from-top-4 duration-300">
                        <h3 className="text-white font-bold mb-4 text-sm tracking-wide">VAP Configuration</h3>
                        <div className="space-y-4 bg-[#1A1C23] p-4 rounded-lg border border-white/5 text-xs text-slate-300">
                            <div className="flex justify-between items-center">
                                <span>Codec</span>
                                <span className="font-mono bg-black/50 px-2 py-0.5 rounded text-white">H.264</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span>Quality Mode</span>
                                <span className="font-mono bg-black/50 px-2 py-0.5 rounded text-white">CRF</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span>CRF Value</span>
                                <input type="number" defaultValue="23" className="bg-[#0E0F14] border border-white/10 rounded w-16 text-center py-1 text-white" />
                            </div>
                            <div className="flex justify-between items-center">
                                <span>Alpha Layout</span>
                                <span className="font-mono bg-black/50 px-2 py-0.5 rounded text-white">Scale Down Filter</span>
                            </div>
                        </div>
                    </div>
                 )}

                 {/* Action */}
                 <button 
                    onClick={handleStartConversion} 
                    disabled={isProcessing}
                    className="w-full relative group overflow-hidden bg-gradient-to-r from-sky-500 to-indigo-500 text-white font-bold py-4 rounded-xl shadow-lg transition-transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
                 >
                    {isProcessing ? 'Processing... Please Wait' : 'Start Conversion Engine'}
                 </button>

              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
