import React, { useState } from 'react';
import { UploadCloud, Video, Images, LayoutGrid, Zap, Layers, Lock, Film, Gift, FileVideo } from 'lucide-react';

export type UploadMode = 'single' | 'batch-mp4' | 'batch-svga';

interface UploaderProps {
  onUpload: (files: File[], mode?: UploadMode) => void;
  isUploading: boolean;
  onConverterOpen?: () => void;
  onMultiSvgaOpen?: () => void;
  onBatchImageOpen?: () => void;
  onPagConverterOpen?: () => void;
  onAnimationManagerOpen?: () => void;
  globalQuality?: 'low' | 'medium' | 'high';
  setGlobalQuality?: (q: 'low' | 'medium' | 'high') => void;
  initialMode?: UploadMode;
}

export const Uploader: React.FC<UploaderProps> = ({ 
  onUpload, 
  isUploading, 
  onConverterOpen, 
  onMultiSvgaOpen, 
  onBatchImageOpen, 
  onPagConverterOpen, 
  onAnimationManagerOpen, 
  globalQuality = 'high', 
  setGlobalQuality,
  initialMode = 'single'
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadMode, setUploadMode] = useState<UploadMode>(initialMode);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onUpload(Array.from(e.target.files), uploadMode);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onUpload(Array.from(e.dataTransfer.files), uploadMode);
    }
  };

  const acceptTypes = uploadMode === 'batch-mp4'
    ? ".mp4,.MP4,.mov,.MOV,.webm,.WEBM,.vap,.VAP,video/*"
    : uploadMode === 'batch-svga'
    ? ".svga,.SVGA,.zip,.ZIP,.pdf,.PDF,application/pdf"
    : ".vap,.VAP,.pag,.PAG,.svga,.SVGA,.mp4,.MP4,.webm,.WEBM,.mov,.MOV,.json,.JSON,.zip,.ZIP,.pdf,.PDF,application/pdf,*/*";

  return (
    <div className="relative max-w-5xl mx-auto flex flex-col gap-4">
      {/* Mode Selector Tabs */}
      <div className="flex items-center justify-center p-1.5 bg-slate-950/70 border border-white/10 rounded-[2rem] shadow-xl backdrop-blur-xl w-full max-w-2xl mx-auto">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setUploadMode('single'); }}
          className={`flex-1 py-3 px-4 rounded-[1.5rem] font-black text-xs transition-all flex items-center justify-center gap-2 cursor-pointer ${
            uploadMode === 'single'
              ? 'bg-gradient-to-r from-sky-500 to-indigo-600 text-white shadow-lg shadow-sky-500/25 scale-[1.02]'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <UploadCloud className="w-4 h-4 shrink-0" />
          <span>رفع ملف فردي</span>
        </button>

        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setUploadMode('batch-mp4'); }}
          className={`flex-1 py-3 px-4 rounded-[1.5rem] font-black text-xs transition-all flex items-center justify-center gap-2 cursor-pointer ${
            uploadMode === 'batch-mp4'
              ? 'bg-gradient-to-r from-sky-500 via-blue-600 to-cyan-500 text-white shadow-lg shadow-blue-500/30 scale-[1.02]'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <FileVideo className="w-4 h-4 shrink-0 text-sky-300" />
          <span>تحويل MP4 جماعي</span>
          <span className="px-1.5 py-0.5 rounded-full text-[9px] bg-sky-400/20 text-sky-200 border border-sky-400/30">جديد</span>
        </button>

        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setUploadMode('batch-svga'); }}
          className={`flex-1 py-3 px-4 rounded-[1.5rem] font-black text-xs transition-all flex items-center justify-center gap-2 cursor-pointer ${
            uploadMode === 'batch-svga'
              ? 'bg-gradient-to-r from-indigo-500 via-purple-600 to-pink-500 text-white shadow-lg shadow-purple-500/30 scale-[1.02]'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Gift className="w-4 h-4 shrink-0 text-purple-300" />
          <span>هدايا SVGA جماعي</span>
          <span className="px-1.5 py-0.5 rounded-full text-[9px] bg-purple-400/20 text-purple-200 border border-purple-400/30">مستقل</span>
        </button>
      </div>

      {/* Main Drop Area */}
      <div 
        className={`relative w-full min-h-[350px] sm:h-[430px] rounded-[2.5rem] sm:rounded-[3rem] border transition-all duration-700 flex flex-col items-center justify-center gap-6 sm:gap-8 p-6 sm:p-12 cursor-pointer overflow-hidden shadow-2xl glass-panel group
          ${isDragOver 
            ? uploadMode === 'batch-mp4' 
              ? 'bg-sky-500/10 scale-[1.02] shadow-[0_0_80px_rgba(14,165,233,0.4)] border-sky-400 rotate-0.5' 
              : uploadMode === 'batch-svga'
              ? 'bg-purple-500/10 scale-[1.02] shadow-[0_0_80px_rgba(168,85,247,0.4)] border-purple-400 rotate-0.5'
              : 'bg-[#4DA3FF]/10 scale-[1.02] shadow-[0_0_80px_rgba(77,163,255,0.4)] border-[#4DA3FF] rotate-0.5'
            : uploadMode === 'batch-mp4'
            ? 'hover:scale-[1.01] hover:border-sky-400/50 border-sky-500/20 hover:shadow-[0_0_50px_rgba(14,165,233,0.2)]'
            : uploadMode === 'batch-svga'
            ? 'hover:scale-[1.01] hover:border-purple-400/50 border-purple-500/20 hover:shadow-[0_0_50px_rgba(168,85,247,0.2)]'
            : 'hover:scale-[1.01] hover:border-[#4DA3FF]/50 border-white/10 hover:shadow-[0_0_50px_rgba(77,163,255,0.2)]'
          }
        `}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => document.getElementById('file-input')?.click()}
      >
        <input 
          id="file-input"
          type="file" 
          accept={acceptTypes}
          className="hidden"
          onChange={handleFileChange}
          multiple
        />

        <div className="absolute -top-32 -left-32 w-80 h-80 bg-[#4DA3FF]/20 blur-[120px] rounded-full pointer-events-none group-hover:bg-[#4DA3FF]/40 transition-all duration-700"></div>
        <div className="absolute -bottom-32 -right-32 w-80 h-80 bg-[#8B5CF6]/20 blur-[120px] rounded-full pointer-events-none group-hover:bg-[#8B5CF6]/40 transition-all duration-700"></div>
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 mix-blend-overlay pointer-events-none"></div>

        <div className="relative group z-10 w-full flex flex-col items-center">
           {/* 3D Portal Core */}
           <div className={`absolute inset-0 bg-gradient-to-tr ${
             uploadMode === 'batch-mp4' ? 'from-sky-500 to-cyan-500' : uploadMode === 'batch-svga' ? 'from-purple-500 to-pink-500' : 'from-[#4DA3FF] to-[#8B5CF6]'
           } blur-3xl transition-all duration-700 pointer-events-none rounded-full mx-auto ${isDragOver ? 'w-64 h-64 opacity-60 animate-spin-slow' : 'w-48 h-48 opacity-20 group-hover:opacity-40 group-hover:scale-110'}`}></div>
           
           <div className={`relative bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl flex items-center justify-center border border-white/20 shadow-[inset_0_1px_1px_rgba(255,255,255,0.4),0_10px_30px_rgba(0,0,0,0.5)] transition-all duration-700 ${
             isDragOver ? 'w-32 h-32 rounded-full border-[#4DA3FF] shadow-[0_0_50px_rgba(77,163,255,0.8)]' : 'w-24 h-24 sm:w-32 sm:h-32 rounded-[2rem] group-hover:rounded-[2.5rem] group-hover:rotate-6'
           }`}>
              {uploadMode === 'batch-mp4' ? (
                <FileVideo className={`transition-all duration-700 ${isDragOver ? 'w-16 h-16 text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.8)]' : 'w-12 h-12 sm:w-16 sm:h-16 text-sky-400 drop-shadow-[0_0_5px_rgba(56,189,248,0.5)]'}`} />
              ) : uploadMode === 'batch-svga' ? (
                <Gift className={`transition-all duration-700 ${isDragOver ? 'w-16 h-16 text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.8)]' : 'w-12 h-12 sm:w-16 sm:h-16 text-purple-400 drop-shadow-[0_0_5px_rgba(192,132,252,0.5)]'}`} />
              ) : (
                <UploadCloud className={`transition-all duration-700 ${isDragOver ? 'w-16 h-16 text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.8)]' : 'w-12 h-12 sm:w-16 sm:h-16 text-[#4DA3FF] drop-shadow-[0_0_5px_rgba(77,163,255,0.5)]'}`} />
              )}
           </div>
        </div>
        
        <div className="text-center relative z-10 px-4 mt-2">
          {uploadMode === 'batch-mp4' ? (
            <>
              <h3 className="text-2xl sm:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-sky-200 to-sky-400 mb-3 tracking-tighter uppercase drop-shadow-[0_0_10px_rgba(56,189,248,0.3)]">
                BATCH MP4 VIDEO CONVERTER
              </h3>
              <p className="text-sky-200/90 font-bold uppercase tracking-[0.2em] sm:tracking-[0.3em] text-[10px] sm:text-[12px] bg-sky-500/10 py-2 px-6 rounded-full inline-block border border-sky-400/20 font-arabic shadow-sm backdrop-blur-md">
                ارفع عدد كبير من ملفات MP4 للتحويل الجماعي بإعدادات موحدة
              </p>
            </>
          ) : uploadMode === 'batch-svga' ? (
            <>
              <h3 className="text-2xl sm:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-purple-200 to-purple-400 mb-3 tracking-tighter uppercase drop-shadow-[0_0_10px_rgba(192,132,252,0.3)]">
                BATCH SVGA GIFTS STUDIO
              </h3>
              <p className="text-purple-200/90 font-bold uppercase tracking-[0.2em] sm:tracking-[0.3em] text-[10px] sm:text-[12px] bg-purple-500/10 py-2 px-6 rounded-full inline-block border border-purple-400/20 font-arabic shadow-sm backdrop-blur-md">
                ارفع مجموعة هدايا SVGA - كل هدية مستقلة تماماً في التعديل والمعاينة
              </p>
            </>
          ) : (
            <>
              <h3 className="text-2xl sm:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-[#4DA3FF] mb-4 tracking-tighter uppercase drop-shadow-[0_0_10px_rgba(77,163,255,0.3)]">
                DROP YOUR SVGA FILE
              </h3>
              <p className="text-white/80 font-bold uppercase tracking-[0.2em] sm:tracking-[0.4em] text-[10px] sm:text-[12px] bg-white/5 py-2 px-6 rounded-full inline-block border border-white/10 font-arabic shadow-sm backdrop-blur-md">
                Drag & Drop or Browse
              </p>
            </>
          )}
        </div>

      <div className="mt-8 relative z-10 w-full px-2 sm:px-4 max-w-5xl mx-auto">
        <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 w-full">
            <div className="flex items-center justify-center gap-3 px-6 py-3 bg-slate-900/80 rounded-2xl border border-white/10 shadow-[0_8px_16px_rgba(0,0,0,0.4)] backdrop-blur-md">
               <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse shadow-[0_0_8px_rgba(99,102,241,0.8)]"></div>
               <span className="text-xs text-slate-300 font-bold uppercase tracking-widest">SVGA 1.0 / 2.0</span>
            </div>
            
            {onAnimationManagerOpen && (
              <button 
                onClick={(e) => { e.stopPropagation(); onAnimationManagerOpen(); }}
                className="flex items-center justify-center gap-3 px-6 py-3 bg-gradient-to-b from-cyan-500/20 to-cyan-600/10 hover:from-cyan-400/30 hover:to-cyan-500/20 rounded-2xl border-t border-cyan-400/30 border-b-4 border-b-cyan-900/50 shadow-lg hover:shadow-[0_10px_20px_rgba(6,182,212,0.2)] hover:-translate-y-1 active:translate-y-1 active:border-b-0 transition-all group/btn"
                title="مدير ومحول ملفات الأنيميشن (GIF / WebP / APNG / Lottie)"
              >
                 <Film className="w-5 h-5 text-cyan-400 group-hover/btn:scale-110 transition-transform drop-shadow-md" />
                 <span className="text-xs text-cyan-300 font-bold uppercase tracking-wide drop-shadow-sm whitespace-nowrap">مدير ومحول الأنيميشن</span>
              </button>
            )}

            {onConverterOpen && (
              <button 
                onClick={(e) => { e.stopPropagation(); onConverterOpen(); }}
                className="flex items-center justify-center gap-3 px-6 py-3 bg-gradient-to-b from-sky-500/20 to-sky-600/10 hover:from-sky-400/30 hover:to-sky-500/20 rounded-2xl border-t border-sky-400/30 border-b-4 border-b-sky-900/50 shadow-lg hover:shadow-[0_10px_20px_rgba(14,165,233,0.2)] hover:-translate-y-1 active:translate-y-1 active:border-b-0 transition-all group/btn"
                title="محول الفيديو المباشر"
              >
                 <Zap className="w-5 h-5 text-sky-400 group-hover/btn:scale-110 transition-transform drop-shadow-md" />
                 <span className="text-xs text-sky-300 font-bold uppercase tracking-wide drop-shadow-sm whitespace-nowrap">محول الفيديو المباشر</span>
              </button>
            )}

            {onMultiSvgaOpen && (
              <button 
                onClick={(e) => { e.stopPropagation(); onMultiSvgaOpen(); }}
                className="flex items-center justify-center gap-3 px-6 py-3 bg-gradient-to-b from-indigo-500/20 to-indigo-600/10 hover:from-indigo-400/30 hover:to-indigo-500/20 rounded-2xl border-t border-indigo-400/30 border-b-4 border-b-indigo-900/50 shadow-lg hover:shadow-[0_10px_20px_rgba(99,102,241,0.2)] hover:-translate-y-1 active:translate-y-1 active:border-b-0 transition-all group/btn"
                title="معاينة متعددة"
              >
                 <LayoutGrid className="w-5 h-5 text-indigo-400 group-hover/btn:scale-110 transition-transform drop-shadow-md" />
                 <span className="text-xs text-indigo-300 font-bold uppercase tracking-wide drop-shadow-sm whitespace-nowrap">معاينة متعددة</span>
              </button>
            )}

            {onBatchImageOpen && (
              <button 
                onClick={(e) => { e.stopPropagation(); onBatchImageOpen(); }}
                className="flex items-center justify-center gap-3 px-6 py-3 bg-gradient-to-b from-emerald-500/20 to-emerald-600/10 hover:from-emerald-400/30 hover:to-emerald-500/20 rounded-2xl border-t border-emerald-400/30 border-b-4 border-b-emerald-900/50 shadow-lg hover:shadow-[0_10px_20px_rgba(16,185,129,0.2)] hover:-translate-y-1 active:translate-y-1 active:border-b-0 transition-all group/btn"
                title="المحول الجماعي للصور"
              >
                 <Images className="w-5 h-5 text-emerald-400 group-hover/btn:scale-110 transition-transform drop-shadow-md" />
                 <span className="text-xs text-emerald-300 font-bold uppercase tracking-wide drop-shadow-sm whitespace-nowrap">المحول الجماعي للصور</span>
              </button>
            )}

            {onPagConverterOpen && (
              <button 
                onClick={(e) => { e.stopPropagation(); onPagConverterOpen(); }}
                className="flex items-center justify-center gap-3 px-6 py-3 bg-gradient-to-b from-purple-500/20 to-purple-600/10 hover:from-purple-400/30 hover:to-purple-500/20 rounded-2xl border-t border-purple-400/30 border-b-4 border-b-purple-900/50 shadow-lg hover:shadow-[0_10px_20px_rgba(168,85,247,0.2)] hover:-translate-y-1 active:translate-y-1 active:border-b-0 transition-all group/btn"
                title="محول PAG إلى SVGA"
              >
                 <Layers className="w-5 h-5 text-purple-400 group-hover/btn:scale-110 transition-transform drop-shadow-md" />
                 <span className="text-xs text-purple-300 font-bold uppercase tracking-wide drop-shadow-sm whitespace-nowrap">محول PAG إلى SVGA</span>
              </button>
            )}

            <button 
              onClick={(e) => {
                e.stopPropagation();
                const input = document.createElement('input');
                input.type = 'file';
                input.multiple = true;
                input.accept = '.pdf,.PDF,application/pdf,*/*';
                input.onchange = (ev: any) => {
                  if (ev.target.files && ev.target.files.length > 0) {
                    onUpload(Array.from(ev.target.files));
                  }
                };
                input.click();
              }}
              className="flex items-center justify-center gap-3 px-6 py-3 bg-gradient-to-b from-amber-500/20 to-rose-600/10 hover:from-amber-400/30 hover:to-rose-500/20 rounded-2xl border-t border-amber-400/30 border-b-4 border-b-amber-900/50 shadow-lg hover:shadow-[0_10px_20px_rgba(245,158,11,0.2)] hover:-translate-y-1 active:translate-y-1 active:border-b-0 transition-all group/btn cursor-pointer"
              title="فك واستخراج ملفات SVGA من PDF"
            >
               <Lock className="w-5 h-5 text-amber-400 group-hover/btn:scale-110 transition-transform drop-shadow-md" />
               <span className="text-xs text-amber-300 font-bold uppercase tracking-wide drop-shadow-sm whitespace-nowrap">فك واستخراج من PDF</span>
            </button>
        </div>
      </div>
    </div>
    </div>
  );
};
