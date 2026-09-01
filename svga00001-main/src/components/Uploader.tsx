
import React, { useState } from 'react';
import { UploadCloud, Video, Images, LayoutGrid, Zap, Layers } from 'lucide-react';

interface UploaderProps {
  onUpload: (files: File[]) => void;
  isUploading: boolean;
  onConverterOpen?: () => void;
  onMultiSvgaOpen?: () => void;
  onBatchImageOpen?: () => void;
  onPagConverterOpen?: () => void;
  globalQuality?: 'low' | 'medium' | 'high';
  setGlobalQuality?: (q: 'low' | 'medium' | 'high') => void;
}

export const Uploader: React.FC<UploaderProps> = ({ onUpload, isUploading, onConverterOpen, onMultiSvgaOpen, onBatchImageOpen, onPagConverterOpen, globalQuality = 'high', setGlobalQuality }) => {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onUpload(Array.from(e.target.files));
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
      onUpload(Array.from(e.dataTransfer.files));
    }
  };

  return (
    <div 
      className={`relative max-w-5xl mx-auto min-h-[350px] sm:h-[450px] rounded-[2.5rem] sm:rounded-[3rem] border border-white/10 transition-all duration-500 flex flex-col items-center justify-center gap-6 sm:gap-10 p-6 sm:p-12 cursor-pointer overflow-hidden backdrop-blur-3xl shadow-2xl
        ${isDragOver ? 'bg-indigo-500/20 scale-[1.02] shadow-[0_0_50px_rgba(99,102,241,0.3)] border-indigo-500/50' : 'bg-[#020617]/60 hover:bg-[#020617]/80 hover:border-white/20'}
      `}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => document.getElementById('file-input')?.click()}
    >
      <input 
        id="file-input"
        type="file" 
        accept=".svga,.mp4,.webm,.mov,.json,application/json"
        className="hidden"
        onChange={handleFileChange}
        multiple
      />

      <div className="absolute -top-24 -left-24 w-64 h-64 bg-indigo-500/10 blur-[100px] rounded-full pointer-events-none"></div>
      <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-purple-600/10 blur-[100px] rounded-full pointer-events-none"></div>
      <div className="absolute inset-0 bg-gradient-to-b from-white/[0.02] to-transparent pointer-events-none"></div>

      <div className="relative group z-10 w-full flex flex-col items-center">
         <div className="absolute inset-0 bg-indigo-500 blur-3xl opacity-20 group-hover:opacity-40 transition-opacity pointer-events-none rounded-full w-40 h-40 mx-auto"></div>
         <div className="relative w-20 h-20 sm:w-28 sm:h-28 bg-gradient-to-br from-indigo-500/20 to-purple-600/20 rounded-3xl flex items-center justify-center text-indigo-400 border border-indigo-400/30 shadow-[0_0_30px_rgba(99,102,241,0.2)] transition-all duration-500 group-hover:scale-110 group-hover:shadow-[0_0_50px_rgba(99,102,241,0.4)]">
            <UploadCloud className="w-10 h-10 sm:w-12 sm:h-12" />
         </div>
      </div>
      
      <div className="text-center relative z-10 px-4">
        <h3 className="text-2xl sm:text-4xl font-black text-white mb-3 tracking-tighter uppercase drop-shadow-lg font-sans tracking-wide">Upload Workspace</h3>
        <p className="text-indigo-400/80 font-black uppercase tracking-[0.2em] sm:tracking-[0.4em] text-[10px] sm:text-[11px] bg-indigo-500/10 py-1.5 px-4 rounded-full inline-block border border-indigo-500/20 font-arabic shadow-sm backdrop-blur-sm">اضغط أو اسحب الملف لرفعه للبدء</p>
      </div>

      <div className="mt-8 relative z-10 w-full px-2 sm:px-4 max-w-5xl mx-auto">
        <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 w-full">
            <div className="flex items-center justify-center gap-3 px-6 py-3 bg-slate-900/80 rounded-2xl border border-white/10 shadow-[0_8px_16px_rgba(0,0,0,0.4)] backdrop-blur-md">
               <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse shadow-[0_0_8px_rgba(99,102,241,0.8)]"></div>
               <span className="text-xs text-slate-300 font-bold uppercase tracking-widest">SVGA 1.0 / 2.0</span>
            </div>
            
            <button 
              onClick={(e) => { e.stopPropagation(); onConverterOpen?.(); }}
              className="flex items-center justify-center gap-3 px-6 py-3 bg-gradient-to-b from-sky-500/20 to-sky-600/10 hover:from-sky-400/30 hover:to-sky-500/20 rounded-2xl border-t border-sky-400/30 border-b-4 border-b-sky-900/50 shadow-lg hover:shadow-[0_10px_20px_rgba(14,165,233,0.2)] hover:-translate-y-1 active:translate-y-1 active:border-b-0 transition-all group/btn"
              title="محول الفيديو المباشر"
            >
               <Zap className="w-5 h-5 text-sky-400 group-hover/btn:scale-110 transition-transform drop-shadow-md" />
               <span className="text-xs text-sky-300 font-bold uppercase tracking-wide drop-shadow-sm whitespace-nowrap">محول الفيديو المباشر</span>
            </button>

            <button 
              onClick={(e) => { e.stopPropagation(); onMultiSvgaOpen?.(); }}
              className="flex items-center justify-center gap-3 px-6 py-3 bg-gradient-to-b from-indigo-500/20 to-indigo-600/10 hover:from-indigo-400/30 hover:to-indigo-500/20 rounded-2xl border-t border-indigo-400/30 border-b-4 border-b-indigo-900/50 shadow-lg hover:shadow-[0_10px_20px_rgba(99,102,241,0.2)] hover:-translate-y-1 active:translate-y-1 active:border-b-0 transition-all group/btn"
              title="معاينة متعددة"
            >
               <LayoutGrid className="w-5 h-5 text-indigo-400 group-hover/btn:scale-110 transition-transform drop-shadow-md" />
               <span className="text-xs text-indigo-300 font-bold uppercase tracking-wide drop-shadow-sm whitespace-nowrap">معاينة متعددة</span>
            </button>

            <button 
              onClick={(e) => { e.stopPropagation(); onBatchImageOpen?.(); }}
              className="flex items-center justify-center gap-3 px-6 py-3 bg-gradient-to-b from-emerald-500/20 to-emerald-600/10 hover:from-emerald-400/30 hover:to-emerald-500/20 rounded-2xl border-t border-emerald-400/30 border-b-4 border-b-emerald-900/50 shadow-lg hover:shadow-[0_10px_20px_rgba(16,185,129,0.2)] hover:-translate-y-1 active:translate-y-1 active:border-b-0 transition-all group/btn"
              title="المحول الجماعي للصور"
            >
               <Images className="w-5 h-5 text-emerald-400 group-hover/btn:scale-110 transition-transform drop-shadow-md" />
               <span className="text-xs text-emerald-300 font-bold uppercase tracking-wide drop-shadow-sm whitespace-nowrap">المحول الجماعي للصور</span>
            </button>

            <button 
              onClick={(e) => { e.stopPropagation(); onPagConverterOpen?.(); }}
              className="flex items-center justify-center gap-3 px-6 py-3 bg-gradient-to-b from-purple-500/20 to-purple-600/10 hover:from-purple-400/30 hover:to-purple-500/20 rounded-2xl border-t border-purple-400/30 border-b-4 border-b-purple-900/50 shadow-lg hover:shadow-[0_10px_20px_rgba(168,85,247,0.2)] hover:-translate-y-1 active:translate-y-1 active:border-b-0 transition-all group/btn"
              title="استخراج طبقات SVGA"
            >
               <Layers className="w-5 h-5 text-purple-400 group-hover/btn:scale-110 transition-transform drop-shadow-md" />
               <span className="text-xs text-purple-300 font-bold uppercase tracking-wide drop-shadow-sm whitespace-nowrap">استخراج طبقات SVGA</span>
            </button>
        </div>
      </div>
    </div>
  );
};
