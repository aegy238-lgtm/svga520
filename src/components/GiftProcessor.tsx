import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import { Upload, Download, RefreshCw, ZoomIn, ZoomOut, Check, ArrowRight } from 'lucide-react';
import { UserRecord } from '../types';

interface GiftProcessorProps {
  currentUser: UserRecord | null;
  onCancel: () => void;
  onLoginRequired: () => void;
}

export const GiftProcessor: React.FC<GiftProcessorProps> = ({ currentUser, onCancel, onLoginRequired }) => {
  const [file, setFile] = useState<File | null>(null);
  const [fileUrl, setFileUrl] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewMode, setPreviewMode] = useState<'split' | 'before' | 'after'>('split');
  const [format, setFormat] = useState('image'); // 'image' or 'mp4' or 'vap'
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const originalCanvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isVideo, setIsVideo] = useState(false);
  
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
    setIsVideo(f.type.startsWith('video') || f.name.toLowerCase().endsWith('.mp4'));
  };

  const processImageToTransparent = (img: HTMLImageElement | HTMLVideoElement, w: number, h: number) => {
    const oCanvas = originalCanvasRef.current;
    const canvas = canvasRef.current;
    if (!oCanvas || !canvas) return;
    
    oCanvas.width = w; oCanvas.height = h;
    canvas.width = w; canvas.height = h;
    
    const oCtx = oCanvas.getContext('2d', { willReadFrequently: true });
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!oCtx || !ctx) return;
    
    oCtx.clearRect(0, 0, w, h);
    oCtx.drawImage(img, 0, 0, w, h);
    
    const imgData = oCtx.getImageData(0, 0, w, h);
    const data = imgData.data;
    const targetData = new Uint8ClampedArray(data.length);
    
    // Magic algorithm to convert white background + shadow/glow to true alpha transparent!
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i+1];
      const b = data[i+2];
      
      // Calculate alpha based on how far the color is from white
      const minColor = Math.min(r, g, b);
      const alpha = 255 - minColor;
      
      if (alpha === 0) {
        targetData[i] = 0;
        targetData[i+1] = 0;
        targetData[i+2] = 0;
        targetData[i+3] = 0;
      } else {
        targetData[i] = Math.min(255, Math.max(0, (255 * (r - 255 + alpha) / alpha)));
        targetData[i+1] = Math.min(255, Math.max(0, (255 * (g - 255 + alpha) / alpha)));
        targetData[i+2] = Math.min(255, Math.max(0, (255 * (b - 255 + alpha) / alpha)));
        targetData[i+3] = alpha;
      }
    }
    
    ctx.putImageData(new ImageData(targetData, w, h), 0, 0);
  };
  
  useEffect(() => {
    if (!fileUrl) return;
    
    if (isVideo) {
      const video = videoRef.current;
      if (!video) return;
      video.src = fileUrl;
      video.muted = true;
      video.play().catch(() => {});
      
      const drawFrame = () => {
         if (!video.paused && !video.ended && video.videoWidth > 0) {
            processImageToTransparent(video, video.videoWidth, video.videoHeight);
         }
         requestAnimationFrame(drawFrame);
      };
      
      video.addEventListener('play', () => {
         drawFrame();
      });
    } else {
      const img = new Image();
      img.onload = () => {
         processImageToTransparent(img, img.width, img.height);
      };
      img.src = fileUrl;
    }
  }, [fileUrl, isVideo]);
  
  const handleExport = () => {
    if (!canvasRef.current || !file) return;
    const link = document.createElement('a');
    link.download = `gift_processed_${file.name.replace(/\.[^/.]+$/, "")}.png`;
    link.href = canvasRef.current.toDataURL('image/png');
    link.click();
  };

  return (
    <div className="min-h-screen bg-[#0E0F14] text-white flex flex-col font-sans overflow-hidden">
      <nav className="flex items-center justify-between px-6 py-4 bg-[#0E0F14]/80 backdrop-blur-md border-b justify-center items-center relative z-20" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
        <div className="absolute pl-4 flex items-center gap-2 cursor-pointer transition select-none hover:opacity-80" onClick={onCancel} style={{left:0}}>
          <div className="w-8 h-8 rounded-full bg-gradient-to-r from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
            <RefreshCw className="w-4 h-4 text-white" />
          </div>
          <span className="font-black text-xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60">GiftProcessor<span className="text-amber-500 text-xs ml-1 font-mono">PRO</span></span>
        </div>
      </nav>

      <div className="flex-1 flex overflow-hidden">
        {!file ? (
          <div className="flex-1 flex flex-col items-center justify-center relative px-4 z-10 w-full h-full">
             <motion.div 
               initial={{ opacity: 0, y: 20 }}
               animate={{ opacity: 1, y: 0 }}
               className="relative z-10 flex flex-col items-center max-w-4xl w-full"
             >
                <h1 className="text-4xl font-black text-white text-center mb-4 tracking-tight">Professional Gift Processing</h1>
                <p className="text-lg text-slate-400 text-center mb-16 font-arabic" dir="rtl">
                   ارفع ملف الهدية (صورة أو VAP). سيتم اكتشاف الخلفية البيضاء وإزالتها تماماً مع الحفاظ على التوهج الحقيقي (Glow) والشفافية.
                </p>
                
                <div 
                   onDragOver={(e) => e.preventDefault()}
                   onDrop={handleFileDrop}
                   onClick={() => fileInputRef.current?.click()}
                   className="w-48 h-48 rounded-full border border-amber-500/30 flex items-center justify-center cursor-pointer hover:bg-amber-900/10 transition group z-20"
                >
                   <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-amber-600 to-orange-500 flex items-center justify-center group-hover:scale-105 transition-transform shadow-[0_0_50px_-10px_rgba(245,158,11,0.5)]">
                      <Upload className="w-10 h-10 text-white" />
                   </div>
                </div>
                <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" accept="image/*,video/mp4" />
             </motion.div>
          </div>
        ) : (
          <div className="flex-1 flex w-full relative h-[calc(100vh-70px)]">
            <div className="flex-1 flex flex-col relative bg-[#14151B] border-r border-[#ffffff0a]">
               
               <div className="absolute top-4 left-4 z-10 flex gap-2">
                 <button onClick={() => setPreviewMode('before')} className={`px-4 py-2 text-xs font-bold rounded ${previewMode === 'before' ? 'bg-amber-600 text-white' : 'bg-slate-800 text-slate-400'}`}>Original</button>
                 <button onClick={() => setPreviewMode('split')} className={`px-4 py-2 text-xs font-bold rounded ${previewMode === 'split' ? 'bg-amber-600 text-white' : 'bg-slate-800 text-slate-400'}`}>Split View</button>
                 <button onClick={() => setPreviewMode('after')} className={`px-4 py-2 text-xs font-bold rounded ${previewMode === 'after' ? 'bg-amber-600 text-white' : 'bg-slate-800 text-slate-400'}`}>Processed</button>
               </div>
               
               <div className="flex-1 flex mt-16 mb-16 relative p-4 gap-4 justify-center items-center">
                  
                  {isVideo && <video ref={videoRef} className="hidden" playsInline muted loop />}
                  
                  {(previewMode === 'before' || previewMode === 'split') && (
                     <div className="flex flex-col items-center flex-1 h-full max-h-full">
                        <span className="text-amber-500 font-bold mb-2">Original (White Background)</span>
                        <div className="w-full h-full border border-white/5 bg-white shadow-2xl rounded-lg overflow-hidden flex items-center justify-center p-4">
                           <canvas ref={originalCanvasRef} className="max-w-full max-h-full object-contain" />
                        </div>
                     </div>
                  )}
                  
                  {previewMode === 'split' && <ArrowRight className="w-8 h-8 text-slate-500 shrink-0" />}

                  {(previewMode === 'after' || previewMode === 'split') && (
                     <div className="flex flex-col items-center flex-1 h-full max-h-full">
                        <span className="text-emerald-400 font-bold mb-2">Processed (True Alpha)</span>
                        <div className="w-full h-full border border-emerald-500/20 rounded-lg overflow-hidden flex items-center justify-center p-4 shadow-[0_0_50px_-20px_rgba(16,185,129,0.3)] relative"
                           style={{ backgroundImage: 'linear-gradient(45deg, #181a20 25%, transparent 25%), linear-gradient(-45deg, #181a20 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #181a20 75%), linear-gradient(-45deg, transparent 75%, #181a20 75%)', backgroundSize: '20px 20px', backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px' }}
                        >
                           <canvas ref={canvasRef} className="max-w-full max-h-full object-contain filter drop-shadow-2xl" />
                        </div>
                     </div>
                  )}
                  
               </div>
            </div>
            
            <div className="w-[300px] bg-[#0E0F14] p-6 space-y-6">
                <div>
                   <h3 className="text-white font-bold mb-4">Export Result</h3>
                   <button onClick={handleExport} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded flex items-center justify-center gap-2 transition shadow-lg shadow-emerald-900/50">
                      <Download className="w-4 h-4" /> Export Asset
                   </button>
                   {isVideo && (
                     <p className="text-xs text-slate-400 mt-2 font-arabic text-center" dir="rtl">
                       (تصدير إطار الصورة الحالي)
                     </p>
                   )}
                </div>
                
                <div className="bg-slate-900 p-4 rounded text-xs text-slate-400 space-y-2 border border-slate-800 font-arabic" dir="rtl">
                   <p className="text-amber-500 font-bold mb-2"><Check className="inline w-3 h-3 mr-1"/> الميزات المطبقة:</p>
                   <p>- إزالة الخلفية البيضاء 100%</p>
                   <p>- استخراج التوهج الأصلي للهدية</p>
                   <p>- الحفاظ على الشفافية المتدرجة</p>
                   <p>- جاهز للتركيب داخل الغرف الصوتية</p>
                </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
