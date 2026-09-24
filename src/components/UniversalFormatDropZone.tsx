import React, { useState, useRef } from 'react';
import { 
  Sparkles, Layers, Upload, Film, Image as ImageIcon, FileVideo, 
  Zap, CheckCircle2, Play, ArrowRight, ShieldCheck, Flame, Cpu
} from 'lucide-react';
import { detectFormat, FORMAT_SPECS, SupportedFormatType } from './UniversalMultiFormatPlayerModal';

interface UniversalFormatDropZoneProps {
  onFileSelected: (file: File) => void;
  className?: string;
  variant?: 'hero' | 'compact' | 'card';
}

export const UniversalFormatDropZone: React.FC<UniversalFormatDropZoneProps> = ({
  onFileSelected,
  className = '',
  variant = 'hero'
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    const f = e.dataTransfer.files?.[0];
    if (f) onFileSelected(f);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      onFileSelected(f);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const supportedGroups = [
    {
      title: 'رسوم متحركة موجهة (Vector & Motion)',
      color: 'from-indigo-500/20 to-purple-500/20 border-indigo-500/30 text-indigo-300',
      badge: 'SVGA • Lottie • DotLottie • PAG',
      formats: ['SVGA', 'Lottie (.json)', 'DotLottie (.lottie)', 'PAG (.pag)']
    },
    {
      title: 'صور متحركة وتسلسلات (Animated Images)',
      color: 'from-amber-500/20 to-orange-500/20 border-amber-500/30 text-amber-300',
      badge: 'GIF • WebP • APNG • PNG ZIP',
      formats: ['GIF', 'WebP', 'APNG', 'PNG 序列帧 ZIP']
    },
    {
      title: 'ملفات الفيديو (Video Media)',
      color: 'from-blue-500/20 to-cyan-500/20 border-blue-500/30 text-blue-300',
      badge: 'MP4 • MOV • WebM',
      formats: ['MP4', 'MOV', 'WebM']
    },
    {
      title: 'فيديو شفاف وألفا (Transparent Alpha Video)',
      color: 'from-pink-500/20 to-rose-500/20 border-pink-500/30 text-pink-300',
      badge: 'VAP • YYEVA • ثنائي القناة',
      formats: ['VAP', 'YYEVA', '双通道透明视频']
    },
    {
      title: 'فيكتور وتفاعلي (SVG Vector & SMIL)',
      color: 'from-emerald-500/20 to-teal-500/20 border-emerald-500/30 text-emerald-300',
      badge: 'SVG / SMIL',
      formats: ['SVG', 'SMIL Vector']
    }
  ];

  return (
    <div className={`w-full ${className}`} dir="rtl">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileInputChange}
        className="hidden"
        accept=".svga,.SVGA,.json,.JSON,.lottie,.LOTTIE,.pag,.PAG,.gif,.GIF,.webp,.WEBP,.apng,.APNG,.png,.PNG,.zip,.ZIP,.mp4,.MP4,.mov,.MOV,.webm,.WEBM,.vap,.VAP,.svg,.SVG,video/*,image/*,application/json,application/zip,application/octet-stream"
        id="universal-format-file-input"
      />

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative group rounded-3xl p-6 sm:p-8 transition-all cursor-pointer overflow-hidden border-2 border-dashed ${
          isDragOver
            ? 'border-indigo-400 bg-indigo-500/15 scale-[1.01] shadow-2xl shadow-indigo-500/20'
            : 'border-indigo-500/40 hover:border-indigo-400 bg-gradient-to-b from-slate-900/90 via-indigo-950/25 to-slate-900/90 hover:bg-slate-900/95 shadow-xl'
        }`}
      >
        {/* Glow ambient background */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3/4 h-32 bg-indigo-500/10 blur-3xl pointer-events-none rounded-full group-hover:bg-indigo-500/20 transition-all" />

        <div className="relative z-10 flex flex-col items-center text-center space-y-4 max-w-2xl mx-auto">
          
          {/* Main Glowing Center Icon */}
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-500 flex items-center justify-center text-white shadow-xl shadow-indigo-600/30 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300">
            <Upload className="w-8 h-8 animate-pulse" />
          </div>

          {/* Title & Description */}
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 text-xs font-bold mb-1">
              <Sparkles className="w-3.5 h-3.5" />
              <span>الخانة الموحدة الشاملة لجميع الصيغ (Universal Multi-Format)</span>
            </div>
            
            <h3 className="text-xl sm:text-2xl font-black text-white group-hover:text-indigo-200 transition-colors">
              اسحب وأفلت أو اختر أي ملف لنقله مباشرة إلى سكريبت أفتر افكت وتشغيله فوراً
            </h3>
            
            <p className="text-xs text-slate-300 max-w-lg mx-auto leading-relaxed">
              يدعم النظام التعرّف التلقائي الفوري على كافة الصيغ الـ 15 ونقلها مباشرة إلى محرر وطبقات سكريبت أفتر افكت مع التشغيل التلقائي الكامل وفك التشفير.
            </p>
          </div>

          {/* Supported Format Pills Matrix */}
          <div className="w-full grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 pt-2 text-right">
            {supportedGroups.map((grp, idx) => (
              <div
                key={idx}
                className={`p-2.5 rounded-xl border bg-gradient-to-br ${grp.color} flex flex-col justify-between transition-all group-hover:border-white/20`}
              >
                <div className="text-[11px] font-black leading-tight text-white mb-1.5">
                  {grp.title}
                </div>
                <div className="text-[10px] font-mono opacity-90 leading-relaxed break-words">
                  {grp.badge}
                </div>
              </div>
            ))}
          </div>

          {/* Action Trigger Button */}
          <div className="pt-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
              className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-indigo-600/30 group-hover:shadow-indigo-600/50 hover:scale-105 active:scale-95 transition-all flex items-center gap-2 cursor-pointer"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>اختيار ملف ونقله وتشغيله في سكريبت أفتر افكت فوراً</span>
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};
