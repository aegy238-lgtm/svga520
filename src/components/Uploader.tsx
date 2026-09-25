import React, { useState, useRef } from 'react';
import { UploadCloud, Video, Images, LayoutGrid, Zap, Layers, Lock, Film, Gift, FileVideo, ShoppingBag, Globe, Sparkles } from 'lucide-react';
import { DashboardExternalLinks } from '../types';
import { UniversalFormatDropZone } from './UniversalFormatDropZone';

export type UploadMode = 'single' | 'batch-mp4' | 'batch-svga' | 'universal';

interface UploaderProps {
  onUpload: (files: File[], mode?: UploadMode) => void;
  isUploading: boolean;
  onConverterOpen?: () => void;
  onMultiSvgaOpen?: () => void;
  onBatchImageOpen?: () => void;
  onAnimationManagerOpen?: () => void;
  onUniversalPlay?: (file: File) => void;
  globalQuality?: 'low' | 'medium' | 'high';
  setGlobalQuality?: (q: 'low' | 'medium' | 'high') => void;
  initialMode?: UploadMode;
  onOpenEmbeddedPortal?: (tabId?: 'first' | 'second' | string) => void;
  externalLinksConfig?: DashboardExternalLinks;
}

export const Uploader: React.FC<UploaderProps> = ({ 
  onUpload, 
  isUploading, 
  onConverterOpen, 
  onMultiSvgaOpen, 
  onBatchImageOpen, 
  onAnimationManagerOpen, 
  onUniversalPlay,
  globalQuality = 'high', 
  setGlobalQuality,
  initialMode = 'single',
  onOpenEmbeddedPortal,
  externalLinksConfig
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadMode, setUploadMode] = useState<UploadMode>(initialMode);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const storeLink = externalLinksConfig?.storeLink;
  const svgaEditorLink = externalLinksConfig?.svgaEditorLink;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      onUpload(files, uploadMode);
      e.target.value = '';
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
      const files = Array.from(e.dataTransfer.files);
      onUpload(files, uploadMode);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const acceptTypes = uploadMode === 'batch-mp4'
    ? ".mp4,.MP4,.mov,.MOV,.webm,.WEBM,.vap,.VAP,video/*"
    : uploadMode === 'batch-svga'
    ? ".svga,.SVGA,.zip,.ZIP,.pdf,.PDF,application/pdf"
    : ".vap,.VAP,.pag,.PAG,.svga,.SVGA,.mp4,.MP4,.webm,.WEBM,.mov,.MOV,.json,.JSON,.zip,.ZIP,.pdf,.PDF,application/pdf,*/*";

  return (
    <div className="relative max-w-5xl mx-auto flex flex-col gap-5">
      {/* Mode Selector Tabs */}
      <div className="flex items-center justify-center p-1.5 bg-[#080d1a]/90 border border-white/[0.08] rounded-2xl shadow-xl backdrop-blur-2xl w-full max-w-2xl mx-auto gap-1">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setUploadMode('single'); }}
          className={`flex-1 py-2.5 px-3 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer ${
            uploadMode === 'single'
              ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-md shadow-indigo-600/30 font-extrabold'
              : 'text-slate-400 hover:text-white hover:bg-white/[0.05]'
          }`}
        >
          <UploadCloud className="w-4 h-4 shrink-0" />
          <span>رفع ملف فردي</span>
        </button>

        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setUploadMode('batch-mp4'); }}
          className={`flex-1 py-2.5 px-3 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer ${
            uploadMode === 'batch-mp4'
              ? 'bg-gradient-to-r from-sky-600 to-indigo-600 text-white shadow-md shadow-sky-600/30 font-extrabold'
              : 'text-slate-400 hover:text-white hover:bg-white/[0.05]'
          }`}
        >
          <FileVideo className="w-4 h-4 shrink-0 text-sky-400" />
          <span>تحويل MP4 جماعي</span>
        </button>

        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setUploadMode('batch-svga'); }}
          className={`flex-1 py-2.5 px-3 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer ${
            uploadMode === 'batch-svga'
              ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-600/30 font-extrabold'
              : 'text-slate-400 hover:text-white hover:bg-white/[0.05]'
          }`}
        >
          <Gift className="w-4 h-4 shrink-0 text-purple-300" />
          <span>هدايا SVGA جماعي</span>
        </button>

        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setUploadMode('universal'); }}
          className={`flex-1 py-2.5 px-3 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer ${
            uploadMode === 'universal'
              ? 'bg-gradient-to-r from-amber-500 to-indigo-600 text-white shadow-md shadow-amber-500/25 font-extrabold'
              : 'text-slate-400 hover:text-white hover:bg-white/[0.05]'
          }`}
        >
          <Sparkles className="w-4 h-4 shrink-0 text-amber-300" />
          <span>مشغل 15 صيغة</span>
        </button>
      </div>

      {uploadMode === 'universal' ? (
        <div className="w-full">
          <UniversalFormatDropZone 
            onFileSelected={(file) => {
              if (onUniversalPlay) {
                onUniversalPlay(file);
              } else {
                onUpload([file], 'single');
              }
            }}
          />
        </div>
      ) : (
      /* Main Drop Area */
      <div 
        className={`relative w-full min-h-[300px] sm:min-h-[360px] rounded-3xl border-2 border-dashed transition-all duration-300 flex flex-col items-center justify-center gap-5 sm:gap-6 p-6 sm:p-10 cursor-pointer overflow-hidden shadow-2xl bg-[#080d1a]/85 backdrop-blur-2xl group
          ${isDragOver 
            ? 'border-indigo-400 bg-indigo-500/10 shadow-[0_0_50px_rgba(99,102,241,0.25)]' 
            : 'border-white/[0.12] hover:border-indigo-500/50 hover:bg-[#0c1428]/90'
          }
        `}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => {
          if (uploadMode === 'single' && externalLinksConfig?.linkHeroUploadToExternal && onOpenEmbeddedPortal) {
            onOpenEmbeddedPortal(externalLinksConfig.heroUploadTarget || 'first');
            return;
          }
          fileInputRef.current?.click();
        }}
      >
        <input 
          ref={fileInputRef}
          id="file-input"
          type="file" 
          accept={acceptTypes}
          className="hidden"
          onChange={handleFileChange}
          multiple
        />

        {/* Ambient subtle light */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 bg-indigo-600/10 blur-[110px] rounded-full pointer-events-none group-hover:bg-indigo-600/20 transition-all duration-500"></div>

        <div className="relative z-10 flex flex-col items-center">
           <div className={`w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-[#0f172a] border border-white/[0.12] flex items-center justify-center shadow-xl transition-all duration-300 group-hover:scale-105 group-hover:border-indigo-400/40 group-hover:shadow-[0_0_25px_rgba(99,102,241,0.25)] ${
              isDragOver ? 'border-indigo-400 bg-indigo-500/20' : ''
           }`}>
              {uploadMode === 'batch-mp4' ? (
                <FileVideo className="w-10 h-10 sm:w-12 sm:h-12 text-sky-400 group-hover:scale-110 transition-transform" />
              ) : uploadMode === 'batch-svga' ? (
                <Gift className="w-10 h-10 sm:w-12 sm:h-12 text-purple-400 group-hover:scale-110 transition-transform" />
              ) : (
                <UploadCloud className="w-10 h-10 sm:w-12 sm:h-12 text-indigo-400 group-hover:scale-110 transition-transform" />
              )}
           </div>
        </div>
        
        <div className="text-center relative z-10 px-4">
          {uploadMode === 'batch-mp4' ? (
            <>
              <h3 className="text-xl sm:text-2xl font-black text-white mb-2 tracking-tight">
                تحويل دفعات الفيديو الجماعية
              </h3>
              <p className="text-xs text-slate-400 font-medium font-arabic max-w-md mx-auto">
                اسحب وأفلت أو انقر لاختيار عدة ملفات MP4 / VAP للتحويل الموحد
              </p>
            </>
          ) : uploadMode === 'batch-svga' ? (
            <>
              <h3 className="text-xl sm:text-2xl font-black text-white mb-2 tracking-tight">
                استوديو هدايا SVGA الجماعي
              </h3>
              <p className="text-xs text-slate-400 font-medium font-arabic max-w-md mx-auto">
                اسحب وأفلت ملفات SVGA أو أرشيف ZIP لمعاينة وإدارة كل هدية باستقلالية تامة
              </p>
            </>
          ) : (
            <>
              <h3 className="text-xl sm:text-2xl font-black text-white mb-2 tracking-tight">
                اسحب وأفلت الملف هنا للبدء
              </h3>
              <p className="text-xs text-slate-400 font-medium font-arabic max-w-md mx-auto">
                يدعم SVGA, VAP, PAG, MP4, WebM, Lottie و PDF · تصفح من جهازك
              </p>
              
              <div className="flex flex-wrap items-center justify-center gap-1.5 mt-3.5">
                {['SVGA', 'VAP', 'PAG', 'MP4', 'Lottie', 'WebM', 'PDF'].map((ext) => (
                  <span key={ext} className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-white/[0.05] text-slate-300 border border-white/[0.08]">
                    {ext}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    )}

      {/* Action shortcuts below upload zone */}
      <div className="mt-2 relative z-10 w-full px-1 max-w-5xl mx-auto">
        <div className="flex flex-wrap items-center justify-center gap-2.5 w-full">
            <button
              type="button"
              onClick={(e) => { 
                e.stopPropagation(); 
                setUploadMode('universal');
                if (uploadMode === 'universal') {
                  document.getElementById('universal-format-file-input')?.click();
                }
              }}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-500/15 to-indigo-500/15 hover:from-amber-500/25 hover:to-indigo-500/25 text-amber-200 border border-amber-500/30 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
              title="مشغل كافة صيغ الأنيميشن والفيديو الـ 15 الموحد"
            >
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>مشغل كافة الصيغ (15 صيغة)</span>
            </button>

            <div className="flex items-center justify-center gap-2 px-3.5 py-2.5 bg-[#0b1120] text-slate-400 border border-white/10 rounded-xl text-xs font-semibold">
               <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399]"></span>
               <span>SVGA 1.0 & 2.0 Native</span>
            </div>
            
            {storeLink?.enabled && storeLink?.url && (
              <button 
                onClick={(e) => { e.stopPropagation(); onOpenEmbeddedPortal?.('first'); }}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-[#0b1120] hover:bg-fuchsia-950/40 text-fuchsia-300 border border-fuchsia-500/30 hover:border-fuchsia-500/50 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm"
                title={storeLink.title || 'المتجر'}
              >
                 <ShoppingBag className="w-4 h-4 text-fuchsia-400" />
                 <span>{storeLink.title || 'المتجر'}</span>
              </button>
            )}

            {svgaEditorLink?.enabled && svgaEditorLink?.url && (
              <button 
                onClick={(e) => { e.stopPropagation(); onOpenEmbeddedPortal?.('second'); }}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-[#0b1120] hover:bg-cyan-950/40 text-cyan-300 border border-cyan-500/30 hover:border-cyan-500/50 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm"
                title={svgaEditorLink.title || 'محرر SVGA'}
              >
                 <Layers className="w-4 h-4 text-cyan-400" />
                 <span>{svgaEditorLink.title || 'محرر SVGA'}</span>
              </button>
            )}

            {onAnimationManagerOpen && (
              <button 
                onClick={(e) => { e.stopPropagation(); onAnimationManagerOpen(); }}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-[#0b1120] hover:bg-[#131d36] text-slate-200 border border-white/10 hover:border-indigo-500/30 rounded-xl text-xs font-bold transition-all cursor-pointer"
                title="مدير ومحول ملفات الأنيميشن (GIF / WebP / APNG / Lottie)"
              >
                 <Film className="w-4 h-4 text-indigo-400" />
                 <span>مدير ومحول الأنيميشن</span>
              </button>
            )}

            {onConverterOpen && (
              <button 
                onClick={(e) => { e.stopPropagation(); onConverterOpen(); }}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-[#0b1120] hover:bg-[#131d36] text-slate-200 border border-white/10 hover:border-indigo-500/30 rounded-xl text-xs font-bold transition-all cursor-pointer"
                title="محول الفيديو المباشر"
              >
                 <Zap className="w-4 h-4 text-sky-400" />
                 <span>محول الفيديو المباشر</span>
              </button>
            )}

            {onMultiSvgaOpen && (
              <button 
                onClick={(e) => { e.stopPropagation(); onMultiSvgaOpen(); }}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-[#0b1120] hover:bg-[#131d36] text-slate-200 border border-white/10 hover:border-indigo-500/30 rounded-xl text-xs font-bold transition-all cursor-pointer"
                title="معاينة متعددة"
              >
                 <LayoutGrid className="w-4 h-4 text-indigo-400" />
                 <span>معاينة متعددة</span>
              </button>
            )}

            {onBatchImageOpen && (
              <button 
                onClick={(e) => { e.stopPropagation(); onBatchImageOpen(); }}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-[#0b1120] hover:bg-[#131d36] text-slate-200 border border-white/10 hover:border-indigo-500/30 rounded-xl text-xs font-bold transition-all cursor-pointer"
                title="المحول الجماعي للصور"
              >
                 <Images className="w-4 h-4 text-emerald-400" />
                 <span>المحول الجماعي للصور</span>
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
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-[#0b1120] hover:bg-amber-950/30 text-amber-300 border border-amber-500/30 hover:border-amber-500/50 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm"
              title="فك واستخراج ملفات SVGA من PDF"
            >
               <Lock className="w-4 h-4 text-amber-400" />
               <span>فك من PDF</span>
            </button>
        </div>
      </div>
    </div>
  );
};
