
import React, { useState, useRef, useEffect } from 'react';
import { UserRecord } from '../types';
import { useAccessControl } from '../hooks/useAccessControl';
import { Download, Trash2, Upload, Check, X, FileImage, Settings, HelpCircle, Image as ImageIcon, AlertCircle, Eye, RefreshCw } from 'lucide-react';
import JSZip from 'jszip';
import imageCompression from 'browser-image-compression';

interface ImageFile {
  file: File;
  id: string;
  status: 'pending' | 'processing' | 'done' | 'error';
  progress: number;
  originalSize: number;
  compressedSize?: number;
  previewUrl: string;
  savingPercent?: number;
  blob?: Blob;
}

interface BatchCompressorProps {
  onCancel: () => void;
  currentUser: UserRecord | null;
  onLoginRequired: () => void;
  onSubscriptionRequired: () => void;
  globalQuality?: 'low' | 'medium' | 'high';
}

export const BatchCompressor: React.FC<BatchCompressorProps> = ({ onCancel, currentUser, onLoginRequired, onSubscriptionRequired }) => {
  const { checkAccess } = useAccessControl();
  const [images, setImages] = useState<ImageFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [quality, setQuality] = useState<number>(80);
  const [maxWidthHelper, setMaxWidthHelper] = useState<string>('original');
  const [outputFormat, setOutputFormat] = useState<string>('original');
  const [isDragging, setIsDragging] = useState(false);
  const [previewTarget, setPreviewTarget] = useState<ImageFile | null>(null);
  const [previewData, setPreviewData] = useState<{ url: string, size: number, savingPercent: number, isProcessing: boolean } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (previewTarget) {
        generatePreview(previewTarget, quality, outputFormat, maxWidthHelper);
    }
  }, [previewTarget, quality, outputFormat, maxWidthHelper]);

  const generatePreview = async (img: ImageFile, q: number, format: string, maxW: string) => {
      setPreviewData(p => ({ ...(p || {url: img.previewUrl, size: img.originalSize, savingPercent: 0}), isProcessing: true }));
      try {
            let options: any = {
                useWebWorker: true,
                initialQuality: q / 100,
                alwaysKeepResolution: maxW === 'original'
            };
            if (maxW !== 'original') options.maxWidthOrHeight = parseInt(maxW);
            if (format !== 'original') options.fileType = format;
            
            const compressedFile = await imageCompression(img.file, options);
            
            let finalBlob: Blob = compressedFile;
            if (compressedFile.size >= img.originalSize && format === 'original' && maxW === 'original') {
                finalBlob = img.file; 
            }

            const savingPercent = img.originalSize > finalBlob.size 
                ? Math.round(((img.originalSize - finalBlob.size) / img.originalSize) * 100) 
                : 0;
            
            const previewUrl = URL.createObjectURL(finalBlob);
            setPreviewData({ url: previewUrl, size: finalBlob.size, savingPercent, isProcessing: false });
      } catch (e) {
          console.error("Preview error", e);
          setPreviewData(p => ({ ...(p || {url: img.previewUrl, size: img.originalSize, savingPercent: 0}), isProcessing: false }));
      }
  };


  useEffect(() => {
    return () => {
      images.forEach(img => URL.revokeObjectURL(img.previewUrl));
    };
  }, []);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(Array.from(e.target.files));
  };

  const addFiles = (files: File[]) => {
    const validFiles = files.filter(f => f.type.startsWith('image/'));
    const newImages: ImageFile[] = validFiles.map(file => ({
      file,
      id: Math.random().toString(36).substring(2, 11) + Date.now(),
      status: 'pending',
      progress: 0,
      originalSize: file.size,
      previewUrl: URL.createObjectURL(file)
    }));
    setImages(prev => [...prev, ...newImages]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const runCompression = async () => {
      if (images.length === 0 || isProcessing) return;
      if (!currentUser) { onLoginRequired(); return; }
      
      const { allowed } = await checkAccess('Batch Compression');
      if (!allowed) {
        onSubscriptionRequired();
        return;
      }

      setIsProcessing(true);

      // Reset states
      setImages(prev => prev.map(img => ({ ...img, status: 'pending', progress: 0, blob: undefined })));
      
      // Let React update UI
      await new Promise(r => setTimeout(r, 100));

      const CONCURRENCY = navigator.hardwareConcurrency ? Math.min(navigator.hardwareConcurrency, 4) : 4;
      const processQueue = [...images];
      
      let maxWidthOrHeight = undefined;
      if (maxWidthHelper !== 'original') {
          maxWidthOrHeight = parseInt(maxWidthHelper);
      }

      const workers = Array(CONCURRENCY).fill(null).map(async () => {
        while (processQueue.length > 0) {
          const item = processQueue.shift();
          if (!item) break;
          
          setImages(prev => prev.map(img => img.id === item.id ? { ...img, status: 'processing', progress: 10 } : img));

          try {
            let options: any = {
                useWebWorker: true,
                initialQuality: quality / 100,
                alwaysKeepResolution: maxWidthHelper === 'original'
            };
            if (maxWidthOrHeight) options.maxWidthOrHeight = maxWidthOrHeight;
            if (outputFormat !== 'original') options.fileType = outputFormat;
            
            options.onProgress = (p: number) => {
                 setImages(prev => prev.map(img => img.id === item.id ? { ...img, progress: Math.max(10, p) } : img));
            };

            const compressedFile = await imageCompression(item.file, options);
            
            let finalBlob: Blob = compressedFile;
            // If it unexpectedly grew and it's the exact same requirements, keep original
            if (compressedFile.size >= item.originalSize && outputFormat === 'original' && maxWidthHelper === 'original') {
                finalBlob = item.file; 
            }

            const savingPercent = item.originalSize > finalBlob.size 
                ? Math.round(((item.originalSize - finalBlob.size) / item.originalSize) * 100) 
                : 0;

            setImages(prev => prev.map(img => 
              img.id === item.id ? { ...img, status: 'done', compressedSize: finalBlob.size, savingPercent, progress: 100, blob: finalBlob } : img
            ));
          } catch (e) {
            console.error("Compression processing error:", e);
            setImages(prev => prev.map(img => img.id === item.id ? { ...img, status: 'error', progress: 0 } : img));
          }
        }
      });

      await Promise.all(workers);
      setIsProcessing(false);
  };

  const handleDownloadClick = async () => {
      const doneImages = images.filter(img => img.status === 'done' && img.blob);
      if (doneImages.length === 0) return;
      
      const zip = new JSZip();
      doneImages.forEach(img => {
          let ext = img.file.name.split('.').pop();
          const name = img.file.name.replace(/\.[^/.]+$/, "");
          
          if (outputFormat !== 'original') {
              ext = outputFormat.split('/')[1] || ext;
              if (ext === 'jpeg') ext = 'jpg';
          }

          zip.file(`${name}_optimized_${quality}.${ext}`, img.blob!);
      });

      const content = await zip.generateAsync({ type: "blob" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(content);
      link.download = `Quantum_Optimized_Images.zip`;
      link.click();
  };

  const totalOriginalSize = images.reduce((acc, img) => acc + img.originalSize, 0);
  const totalCompressedSize = images.reduce((acc, img) => acc + (img.compressedSize || 0), 0);
  const totalSaved = totalOriginalSize - totalCompressedSize;
  const totalSavedPercent = totalOriginalSize > 0 ? (totalSaved / totalOriginalSize) * 100 : 0;
  const successCount = images.filter(img => img.status === 'done').length;
  const hasDone = successCount > 0;

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex flex-col font-sans overflow-hidden">
      {/* Header */}
      <div className="shrink-0 h-16 border-b border-slate-800/50 flex items-center justify-between px-6 bg-slate-900/50">
          <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                  <FileImage className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                  <h1 className="text-white font-bold tracking-wide">ضغط وتصغير الصور (Pro)</h1>
                  <p className="text-[10px] text-slate-400 font-medium">Batch Image Compression</p>
              </div>
          </div>
          <button onClick={onCancel} className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center hover:bg-slate-700 hover:text-white transition-all text-slate-400">
              <X className="w-5 h-5" />
          </button>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
          {/* Main Area: Dropzone and Grid */}
          <div className="flex-1 flex flex-col overflow-y-auto custom-scrollbar p-6">
              
              {/* Dropzone */}
              <div 
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`
                      shrink-0 border-2 border-dashed rounded-3xl p-10 flex flex-col items-center justify-center cursor-pointer transition-all min-h-[240px] mb-8
                      ${isDragging ? 'border-blue-500 bg-blue-500/10 scale-[1.02]' : 'border-slate-800 bg-slate-900/30 hover:border-blue-500 hover:bg-blue-500/5'}
                  `}
              >
                  <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-6 transition-transform shadow-2xl ${isDragging ? 'bg-blue-500 scale-110' : 'bg-slate-800 group-hover:scale-110'}`}>
                      <Upload className={`w-8 h-8 ${isDragging ? 'text-white' : 'text-slate-400 group-hover:text-blue-500'}`} />
                  </div>
                  <h2 className="text-white font-bold text-xl mb-2">اسحب وأفلت الصور هنا</h2>
                  <p className="text-slate-400 text-sm">أو اضغط لاختيار الملفات (يدعم JPG, PNG, WEBP)</p>
                  <input type="file" multiple ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileSelect} />
              </div>

              {/* Grid */}
              {images.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 pb-12">
                      {images.map(img => (
                          <div key={img.id} className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-4 flex gap-4 overflow-hidden shadow-lg hover:border-slate-700 transition-colors">
                              <div className="w-16 h-16 rounded-xl bg-slate-950 border border-slate-800 overflow-hidden shrink-0 relative flex items-center justify-center">
                                  <img src={img.previewUrl} className="max-w-full max-h-full object-contain" alt="" />
                                  {img.status === 'processing' && (
                                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-[2px]">
                                          <div className="text-[10px] font-bold text-white">{Math.round(img.progress)}%</div>
                                      </div>
                                  )}
                              </div>
                              
                              <div className="flex-1 min-w-0 flex flex-col justify-center">
                                  <div className="flex justify-between items-start mb-1.5">
                                      <h4 className="text-slate-200 font-medium text-xs truncate" title={img.file.name}>{img.file.name}</h4>
                                      {img.status === 'done' && (
                                          <span className="text-emerald-400 text-[10px] font-black bg-emerald-400/10 px-1.5 py-0.5 rounded border border-emerald-500/20 shadow-[0_0_10px_rgba(52,211,153,0.1)]">
                                              -{img.savingPercent}%
                                          </span>
                                      )}
                                      {img.status === 'error' && (
                                          <span className="text-red-400 text-[10px] font-black"><AlertCircle className="w-3 h-3" /></span>
                                      )}
                                      
                                      <div className="flex gap-2 ml-auto">
                                          <button 
                                              onClick={() => setPreviewTarget(img)} 
                                              disabled={isProcessing}
                                              className="text-slate-500 hover:text-blue-400 outline-none transition-colors disabled:opacity-50"
                                              title="معاينة الجودة"
                                          >
                                              <Eye className="w-3.5 h-3.5" />
                                          </button>
                                          {img.status === 'pending' && !isProcessing && (
                                              <button onClick={() => setImages(p => p.filter(i => i.id !== img.id))} className="text-slate-500 hover:text-red-400 outline-none transition-colors">
                                                  <X className="w-3.5 h-3.5" />
                                              </button>
                                          )}
                                      </div>
                                  </div>
                                  
                                  <div className="flex items-center gap-2 text-[11px]">
                                      <span className="text-slate-500">{formatSize(img.originalSize)}</span>
                                      {img.status === 'done' && (
                                          <>
                                              <span className="text-slate-600">→</span>
                                              <span className="text-emerald-400 font-bold">{formatSize(img.compressedSize || 0)}</span>
                                          </>
                                      )}
                                  </div>

                                  {img.status === 'processing' && (
                                      <div className="mt-3 h-1.5 bg-slate-950 rounded-full overflow-hidden border border-white/5">
                                          <div className="h-full bg-blue-500 transition-all duration-300 shadow-[0_0_10px_rgba(59,130,246,0.6)]" style={{ width: `${img.progress}%` }}></div>
                                      </div>
                                  )}
                              </div>
                          </div>
                      ))}
                  </div>
              )}
          </div>

          {/* Right Area: Settings Panel */}
          <div className="w-full lg:w-[380px] bg-slate-900/80 border-l border-slate-800/50 p-6 flex flex-col shrink-0 custom-scrollbar overflow-y-auto shadow-2xl relative z-10">
              
              <div className="space-y-8 mb-8">
                  {/* Quality Module */}
                  <div className="bg-black/30 p-5 rounded-2xl border border-slate-800">
                      <div className="flex justify-between items-center mb-5">
                          <label className="text-xs font-bold text-slate-300 uppercase tracking-widest flex items-center gap-2">
                              <Settings className="w-4 h-4 text-slate-500" /> جودة الضغط
                          </label>
                          <div className="bg-blue-500 text-white font-mono text-sm px-3 py-1 rounded-lg font-bold shadow-[0_0_15px_rgba(59,130,246,0.5)]">
                              {quality}%
                          </div>
                      </div>
                      
                      <div className="relative pb-2">
                          <input 
                              type="range" min="1" max="100" value={quality} 
                              onChange={(e) => setQuality(parseInt(e.target.value))}
                              disabled={isProcessing}
                              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer disabled:opacity-50"
                          />
                          <style>{`
                              input[type=range]::-webkit-slider-thumb {
                                  -webkit-appearance: none;
                                  height: 20px;
                                  width: 20px;
                                  border-radius: 50%;
                                  background: #3b82f6;
                                  cursor: pointer;
                                  box-shadow: 0 0 15px rgba(59, 130, 246, 0.8);
                                  margin-top: -9px;
                                  border: 3px solid #1e293b;
                              }
                              input[type=range]::-webkit-slider-runnable-track {
                                  height: 4px;
                                  background: #334155;
                                  border-radius: 2px;
                              }
                          `}</style>
                      </div>
                  </div>

                  {/* Export Options Module */}
                  <div className="space-y-4">
                      <div className="space-y-1">
                          <label className="text-[10px] text-slate-400 uppercase font-black tracking-widest">صيغة الإخراج (Output Format)</label>
                          <select 
                              value={outputFormat} 
                              onChange={e => setOutputFormat(e.target.value)} 
                              disabled={isProcessing}
                              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white font-medium focus:border-blue-500 focus:bg-slate-800 outline-none transition-all cursor-pointer disabled:opacity-50"
                          >
                              <option value="original">الاحتفاظ بالصيغة الأصلية</option>
                              <option value="image/webp">WebP (أفضل ضغط للملفات)</option>
                              <option value="image/jpeg">JPEG (أصغر حجم بدون شفافية)</option>
                              <option value="image/png">PNG (دقة عالية وجودة أصلية)</option>
                          </select>
                      </div>

                      <div className="space-y-1">
                          <label className="text-[10px] text-slate-400 uppercase font-black tracking-widest">تحجيم الأبعاد (Resize)</label>
                          <select 
                              value={maxWidthHelper} 
                              onChange={e => setMaxWidthHelper(e.target.value)} 
                              disabled={isProcessing}
                              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white font-medium focus:border-blue-500 focus:bg-slate-800 outline-none transition-all cursor-pointer disabled:opacity-50"
                          >
                              <option value="original">بدون تغيير (الأبعاد الأصلية)</option>
                              <option value="3840">حد أقصى 4K (3840px)</option>
                              <option value="1920">حد أقصى 1080p (1920px)</option>
                              <option value="1280">حد أقصى 720p (1280px)</option>
                              <option value="1024">حد أقصى (1024px)</option>
                              <option value="800">حد أقصى للويب (800px)</option>
                              <option value="600">حد أقصى (600px)</option>
                              <option value="500">حد أقصى (500px)</option>
                              <option value="400">حد أقصى (400px)</option>
                              <option value="300">حد أقصى أيقونة (300px)</option>
                              <option value="256">حد أقصى (256px)</option>
                              <option value="200">حد أقصى صغير (200px)</option>
                              <option value="150">حد أقصى (150px)</option>
                              <option value="128">حد أقصى مصغر (128px)</option>
                              <option value="100">حد أقصى دقيق (100px)</option>
                          </select>
                      </div>
                  </div>

                  {/* Results Overview */}
                  <div className="bg-black/40 border border-slate-800/80 rounded-2xl p-5 space-y-3">
                      <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-400 font-medium tracking-wide">الصور المستوردة</span>
                          <span className="text-white font-black">{images.length}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-400 font-medium tracking-wide">الحجم الأصلي</span>
                          <span className="text-white font-mono">{formatSize(totalOriginalSize)}</span>
                      </div>
                      {hasDone && (
                          <>
                              <div className="flex justify-between items-center text-xs border-t border-white/5 pt-3">
                                  <span className="text-slate-400 font-medium tracking-wide">الحجم بعد الضغط</span>
                                  <span className="text-emerald-400 font-mono font-black">{formatSize(totalCompressedSize)}</span>
                              </div>
                              <div className="flex justify-between items-center text-xs">
                                  <span className="text-slate-400 font-medium tracking-wide">المساحة الموفرة</span>
                                  <span className="text-emerald-400 font-mono font-black">{formatSize(totalSaved)} ({totalSavedPercent.toFixed(1)}%)</span>
                              </div>
                          </>
                      )}
                  </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-auto space-y-3 pt-6 border-t border-slate-800/80">
                  <button 
                      onClick={runCompression}
                      disabled={images.length === 0 || isProcessing}
                      className={`
                          w-full h-12 rounded-xl font-black text-xs uppercase tracking-widest flex items-center justify-center transition-all
                          ${images.length === 0 || isProcessing ? 'bg-blue-600/30 text-white/50 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-500 shadow-[0_0_20px_rgba(37,99,235,0.4)] active:scale-[0.98]'}
                      `}
                  >
                      {isProcessing ? 'جاري الضغط...' : 'بدء الضغط (Start)'}
                  </button>

                  <button 
                      onClick={handleDownloadClick}
                      disabled={!hasDone || isProcessing}
                      className={`
                          w-full h-12 rounded-xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all border
                          ${!hasDone || isProcessing ? 'bg-transparent border-emerald-500/20 text-emerald-500/30 cursor-not-allowed' : 'bg-emerald-500/10 border-emerald-500 border-opacity-50 text-emerald-400 hover:bg-emerald-500/20 active:scale-[0.98] shadow-[0_0_20px_rgba(52,211,153,0.1)]'}
                      `}
                  >
                      <Download className="w-4 h-4" />
                      تنزيل ZIP
                  </button>

                  {images.length > 0 && !isProcessing && (
                      <button 
                          onClick={() => setImages([])}
                          className="w-full py-3 text-[11px] font-black text-slate-500 hover:text-red-400 uppercase tracking-widest transition-colors"
                      >
                          مسح الكل (Clear)
                      </button>
                  )}
              </div>

          </div>
      </div>

      {previewTarget && previewData && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 p-4 sm:p-8 backdrop-blur-xl animate-in fade-in duration-200">
            <div className="bg-slate-900 border border-slate-700 w-full max-w-6xl h-full max-h-[85vh] rounded-3xl overflow-hidden shadow-2xl flex flex-col ring-1 ring-white/10 ring-offset-4 ring-offset-black/50">
                <div className="flex items-center justify-between p-5 border-b border-white/5 bg-slate-950/80">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                            <Eye className="w-5 h-5 text-blue-400" />
                        </div>
                        <div>
                            <h3 className="text-white font-bold text-sm tracking-wide">
                                معاينة أثر الضغط
                            </h3>
                            <p className="text-slate-400 text-[10px] mt-0.5 max-w-[300px] truncate">{previewTarget.file.name}</p>
                        </div>
                    </div>
                    <button onClick={() => setPreviewTarget(null)} className="text-slate-500 hover:text-white transition-colors bg-white/5 hover:bg-white/10 p-2.5 rounded-full border border-white/5">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <div className="flex-1 flex flex-col lg:flex-row overflow-hidden bg-slate-950">
                    {/* Original */}
                    <div className="flex-1 flex flex-col border-b lg:border-b-0 lg:border-l border-white/5 relative">
                        <div className="absolute top-4 left-4 right-4 flex justify-between items-start z-10 pointer-events-none">
                             <div className="bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10 shadow-xl pointer-events-auto">
                                <span className="text-slate-300 text-xs font-black uppercase tracking-widest block mb-0.5">الصورة الأصلية</span>
                                <span className="text-white text-xs font-mono">{formatSize(previewTarget.originalSize)}</span>
                             </div>
                        </div>
                        <div className="flex-1 p-6 md:p-12 flex items-center justify-center bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCI+CjxyZWN0IHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCIgZmlsbD0iI2ZmZiIgZmlsbC1vcGFjaXR5PSIwLjAyIi8+CjxwYXRoIGQ9Ik0wIDEwaDIwdk0xMCAwdjIwIiBzdHJva2U9IiNmZmYiIHN0cm9rZS1vcGFjaXR5PSIwLjAxIi8+Cjwvc3ZnPg==')] overflow-hidden">
                            <img src={previewTarget.previewUrl} className="max-w-full max-h-full object-contain drop-shadow-2xl rounded-lg" alt="Original" />
                        </div>
                    </div>
                    {/* Compressed */}
                    <div className="flex-1 flex flex-col relative">
                        <div className="absolute top-4 right-4 left-4 flex justify-between items-start z-10 pointer-events-none">
                             <div className="bg-blue-950/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-blue-500/30 shadow-xl pointer-events-auto flex gap-4">
                                <div>
                                    <span className="text-blue-300 text-xs font-black uppercase tracking-widest block mb-0.5 flex items-center gap-1.5">
                                        <Check className="w-3 h-3 text-blue-400" /> بعد الضغط
                                    </span>
                                    <span className="text-blue-100 text-xs font-mono font-bold">{formatSize(previewData.size)}</span>
                                </div>
                                {previewData.savingPercent > 0 && (
                                    <div className="bg-emerald-500/20 text-emerald-400 text-xs px-2.5 py-1 rounded-md border border-emerald-500/30 font-black h-full flex items-center">
                                        توفير {previewData.savingPercent}%
                                    </div>
                                )}
                             </div>
                        </div>
                        <div className="flex-1 p-6 md:p-12 flex items-center justify-center bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCI+CjxyZWN0IHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCIgZmlsbD0iI2ZmZiIgZmlsbC1vcGFjaXR5PSIwLjAyIi8+CjxwYXRoIGQ9Ik0wIDEwaDIwdk0xMCAwdjIwIiBzdHJva2U9IiNmZmYiIHN0cm9rZS1vcGFjaXR5PSIwLjAxIi8+Cjwvc3ZnPg==')] overflow-hidden relative">
                            {previewData.isProcessing ? (
                                <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md flex flex-col items-center justify-center z-20">
                                    <div className="w-14 h-14 border-4 border-slate-800 border-t-blue-500 rounded-full animate-spin mb-4 shadow-[0_0_20px_rgba(59,130,246,0.3)]/50" />
                                    <p className="text-blue-400 text-sm font-bold tracking-widest animate-pulse">جاري تطبيق الإعدادات...</p>
                                </div>
                            ) : (
                                <img src={previewData.url} className="max-w-full max-h-full object-contain drop-shadow-2xl rounded-lg ring-1 ring-white/10" alt="Compressed" />
                            )}
                        </div>
                    </div>
                </div>
                <div className="p-4 border-t border-white/5 bg-slate-950/80 flex justify-center">
                     <p className="text-slate-400 text-[11px] flex items-center gap-2">
                        <RefreshCw className="w-3 h-3 text-slate-500" />
                        قم بتغيير إعدادات الجودة والأبعاد خلف هذه النافذة لرؤية النتيجة فوراً
                     </p>
                </div>
            </div>
        </div>
      )}

    </div>
  );
};

