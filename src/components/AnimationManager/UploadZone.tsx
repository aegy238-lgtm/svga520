import React, { useState, useRef } from 'react';
import { UploadCloud, FileType, CheckCircle2, Sparkles, Layers } from 'lucide-react';
import { SupportedFormat } from './types';

interface UploadZoneProps {
  onFilesSelected: (files: File[]) => void;
  isProcessing?: boolean;
}

const SUPPORTED_BADGES: Array<{ format: SupportedFormat; label: string; color: string }> = [
  { format: 'gif', label: 'GIF', color: 'border-amber-500/40 text-amber-400 bg-amber-500/10' },
  { format: 'webp', label: 'WebP', color: 'border-emerald-500/40 text-emerald-400 bg-emerald-500/10' },
  { format: 'apng', label: 'APNG', color: 'border-purple-500/40 text-purple-400 bg-purple-500/10' },
  { format: 'png', label: 'PNG', color: 'border-sky-500/40 text-sky-400 bg-sky-500/10' },
  { format: 'lottie', label: 'Lottie', color: 'border-cyan-500/40 text-cyan-400 bg-cyan-500/10' },
  { format: 'dotlottie', label: '.lottie', color: 'border-pink-500/40 text-pink-400 bg-pink-500/10' },
  { format: 'svga', label: 'SVGA', color: 'border-rose-500/40 text-rose-400 bg-rose-500/10' },
  { format: 'pag', label: 'PAG', color: 'border-indigo-500/40 text-indigo-400 bg-indigo-500/10' }
];

export const UploadZone: React.FC<UploadZoneProps> = ({ onFilesSelected, isProcessing }) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const scanFiles = async (item: any): Promise<File[]> => {
    if (item.isFile) {
      return new Promise((resolve) => {
        item.file((file: File) => {
          resolve([file]);
        });
      });
    } else if (item.isDirectory) {
      const dirReader = item.createReader();
      let entries: any[] = [];
      let readEntries = async () => {
        const results = await new Promise<any[]>((resolve) => dirReader.readEntries(resolve));
        if (results.length > 0) {
          entries = entries.concat(results);
          await readEntries();
        }
      };
      await readEntries();
      
      const files: File[] = [];
      for (const entry of entries) {
        const nestedFiles = await scanFiles(entry);
        files.push(...nestedFiles);
      }
      return files;
    }
    return [];
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const items = e.dataTransfer.items;
    if (items && items.length > 0) {
      setIsScanning(true);
      const allFiles: File[] = [];
      const promises = [];
      
      for (let i = 0; i < items.length; i++) {
        const item = items[i].webkitGetAsEntry();
        if (item) {
          promises.push(scanFiles(item));
        }
      }
      
      const results = await Promise.all(promises);
      results.forEach(files => allFiles.push(...files));
      
      // Filter only supported types
      const supportedExtensions = ['.gif', '.webp', '.apng', '.png', '.json', '.lottie', '.svga', '.pag'];
      const validFiles = allFiles.filter(f => {
        const name = f.name.toLowerCase();
        return supportedExtensions.some(ext => name.endsWith(ext)) || f.type.includes('image/');
      });
      
      setIsScanning(false);
      if (validFiles.length > 0) {
        onFilesSelected(validFiles);
      }
    } else if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFilesSelected(Array.from(e.dataTransfer.files));
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      const supportedExtensions = ['.gif', '.webp', '.apng', '.png', '.json', '.lottie', '.svga', '.pag'];
      const validFiles = files.filter(f => {
        const name = f.name.toLowerCase();
        return supportedExtensions.some(ext => name.endsWith(ext)) || f.type.includes('image/');
      });
      
      if (validFiles.length > 0) {
        onFilesSelected(validFiles);
      }
      e.target.value = '';
    }
  };

  return (
    <div
      onClick={() => fileInputRef.current?.click()}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`relative w-full rounded-3xl p-8 sm:p-12 border-2 border-dashed transition-all duration-300 cursor-pointer flex flex-col items-center justify-center text-center overflow-hidden group ${
        isDragOver
          ? 'border-[#4DA3FF] bg-[#4DA3FF]/10 scale-[1.01] shadow-[0_0_50px_rgba(77,163,255,0.3)]'
          : 'border-white/15 hover:border-cyan-500/50 bg-gradient-to-b from-[#0e1628]/80 to-[#070b14]/80 hover:bg-[#0e1628]'
      }`}
    >
      {/* Glow effect */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none group-hover:bg-cyan-500/20 transition-all duration-700" />

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".gif,.webp,.apng,.png,.json,.lottie,.svga,.pag,image/gif,image/webp,image/apng,image/png,application/json"
        className="hidden"
        onChange={handleChange}
      />
      <input
        ref={folderInputRef}
        type="file"
        //@ts-ignore
        webkitdirectory="true"
        directory="true"
        multiple
        className="hidden"
        onChange={handleChange}
      />

      <div className="relative z-10 flex flex-col items-center gap-5">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 group-hover:scale-110 group-hover:shadow-[0_0_30px_rgba(6,182,212,0.4)] transition-all duration-300">
          <UploadCloud className="w-10 h-10" />
        </div>

        <div className="flex flex-col gap-2">
          <h3 className="text-2xl sm:text-3xl font-black text-white font-arabic tracking-wide">
            اسحب وأفلت الملفات أو المجلدات هنا
          </h3>
          <p className="text-sm sm:text-base text-gray-400 font-arabic max-w-xl">
            ارفع ملفات أو مجلدات كاملة. سيتم البحث داخل المجلدات واستخراج جميع ملفات الأنيميشن المدعومة تلقائياً.
          </p>
        </div>

        {/* Supported format badges */}
        <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
          {SUPPORTED_BADGES.map((badge) => (
            <span
              key={badge.format}
              className={`px-3 py-1 rounded-full text-xs font-bold border backdrop-blur-sm transition-all ${badge.color}`}
            >
              {badge.label}
            </span>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3 mt-4">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              fileInputRef.current?.click();
            }}
            disabled={isProcessing || isScanning}
            className="px-6 py-3 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-sm shadow-lg shadow-cyan-500/25 transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer flex items-center gap-2"
          >
            <FileType className="w-4 h-4" />
            {isProcessing || isScanning ? 'جاري الفحص...' : 'استعراض ملفات'}
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              folderInputRef.current?.click();
            }}
            disabled={isProcessing || isScanning}
            className="px-6 py-3 rounded-2xl bg-white/5 hover:bg-white/10 text-white font-bold text-sm border border-white/10 transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer flex items-center gap-2"
          >
            <Layers className="w-4 h-4" />
            استعراض مجلد بالكامل
          </button>
        </div>
      </div>
    </div>
  );
};
