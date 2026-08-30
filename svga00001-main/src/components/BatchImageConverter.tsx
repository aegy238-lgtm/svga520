import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Upload, X, Image as ImageIcon, CheckCircle2, AlertCircle, 
  Play, Pause, Download, Settings2, Trash2, RefreshCw, FolderUp,
  FileImage, Layers
} from 'lucide-react';

declare var JSZip: any;

type ConversionStatus = 'pending' | 'processing' | 'done' | 'error' | 'paused';

interface QueuedImage {
  id: string;
  file: File;
  status: ConversionStatus;
  progress: number;
  resultBlob?: Blob;
  error?: string;
}

interface BatchImageConverterProps {
  onClose: () => void;
}

export const BatchImageConverter: React.FC<BatchImageConverterProps> = ({ onClose }) => {
  const [queue, setQueue] = useState<QueuedImage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  
  // Settings
  const [targetFormat, setTargetFormat] = useState('image/jpeg');
  const [quality, setQuality] = useState(80);
  const [resizeEnabled, setResizeEnabled] = useState(false);
  const [maxWidth, setMaxWidth] = useState(1920);
  const [autoStart, setAutoStart] = useState(true);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const processingRef = useRef(false);
  const pausedRef = useRef(false);
  const queueRef = useRef<QueuedImage[]>([]);

  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);

  const handleFilesAdded = (files: FileList | File[]) => {
    const newItems: QueuedImage[] = Array.from(files)
      .filter(file => file.type.startsWith('image/'))
      .map(file => ({
        id: Math.random().toString(36).substring(7) + Date.now(),
        file,
        status: 'pending',
        progress: 0
      }));
    
    setQueue(prev => {
      const next = [...prev, ...newItems];
      queueRef.current = next;
      return next;
    });

    if (autoStart && !processingRef.current) {
      setTimeout(() => {
        startProcessing();
      }, 100);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) {
      handleFilesAdded(e.dataTransfer.files);
    }
  };

  const removeFile = (id: string) => {
    setQueue(prev => prev.filter(item => item.id !== id));
  };

  const clearQueue = () => {
    if (isProcessing) return;
    setQueue([]);
  };

  const processImage = async (item: QueuedImage): Promise<{blob?: Blob, error?: string}> => {
    return new Promise((resolve) => {
        const url = URL.createObjectURL(item.file);
        const img = new Image();
        img.onload = () => {
            URL.revokeObjectURL(url);
            try {
                const canvas = document.createElement('canvas');
                let w = img.width;
                let h = img.height;

                if (resizeEnabled && w > maxWidth) {
                    const ratio = maxWidth / w;
                    w = maxWidth;
                    h = h * ratio;
                }

                canvas.width = w;
                canvas.height = h;
                const ctx = canvas.getContext('2d');
                if (!ctx) throw new Error("Canvas context failed");

                // Fill background if converting to JPEG to avoid black background on transparent PNGs
                if (targetFormat === 'image/jpeg') {
                    ctx.fillStyle = '#FFFFFF';
                    ctx.fillRect(0, 0, w, h);
                }

                ctx.drawImage(img, 0, 0, w, h);

                canvas.toBlob((blob) => {
                    if (blob) resolve({ blob });
                    else resolve({ error: "Compression failed" });
                }, targetFormat, quality / 100);
            } catch (e: any) {
                resolve({ error: e.message });
            }
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            resolve({ error: "Failed to load image" });
        };
        img.src = url;
    });
  };

  const processNext = async () => {
    if (!processingRef.current || pausedRef.current) return;

    const pendingIndex = queueRef.current.findIndex(q => q.status === 'pending');
    
    if (pendingIndex === -1) {
      const isAllDone = queueRef.current.every(q => q.status !== 'processing' && q.status !== 'pending');
      if (isAllDone) {
        setIsProcessing(false);
        processingRef.current = false;
      }
      return;
    }

    const item = queueRef.current[pendingIndex];
    queueRef.current[pendingIndex] = { ...item, status: 'processing', progress: 50 };
    setQueue([...queueRef.current]);

    const result = await processImage(item);

    const updatedIndex = queueRef.current.findIndex(q => q.id === item.id);
    if (updatedIndex !== -1) {
      queueRef.current[updatedIndex] = {
        ...queueRef.current[updatedIndex],
        status: result.error ? 'error' : 'done',
        progress: 100,
        resultBlob: result.blob,
        error: result.error
      };
      setQueue([...queueRef.current]);
    }

    processNext();
  };

  const startProcessing = async () => {
    if (queueRef.current.filter(q => q.status === 'pending').length === 0) return;
    
    setIsProcessing(true);
    setIsPaused(false);
    pausedRef.current = false;
    processingRef.current = true;

    const concurrency = 5; // Process 5 images at a time

    for (let i = 0; i < concurrency; i++) {
        processNext();
    }
  };

  const togglePause = () => {
    if (isPaused) {
        setIsPaused(false);
        pausedRef.current = false;
        startProcessing();
    } else {
        setIsPaused(true);
        pausedRef.current = true;
    }
  };

  const stopProcessing = () => {
    setIsProcessing(false);
    setIsPaused(false);
    processingRef.current = false;
    pausedRef.current = false;
    
    // Reset processing items back to pending
    setQueue(prev => prev.map(item => item.status === 'processing' ? { ...item, status: 'pending', progress: 0 } : item));
  };

  const downloadAll = async () => {
    const doneItems = queue.filter(q => q.status === 'done' && q.resultBlob);
    if (doneItems.length === 0) return;

    const zip = new JSZip();
    const folder = zip.folder("Converted_Images");
    
    const ext = targetFormat.split('/')[1].replace('jpeg', 'jpg');

    doneItems.forEach((item, index) => {
        const originalName = item.file.name.replace(/\.[^/.]+$/, "");
        folder?.file(`${originalName}_converted.${ext}`, item.resultBlob!);
    });

    const content = await zip.generateAsync({ type: "blob" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(content);
    link.download = `Converted_Images_${Date.now()}.zip`;
    link.click();
  };

  const downloadSingle = (item: QueuedImage) => {
    if (!item.resultBlob) return;
    const ext = targetFormat.split('/')[1].replace('jpeg', 'jpg');
    const originalName = item.file.name.replace(/\.[^/.]+$/, "");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(item.resultBlob);
    link.download = `${originalName}_converted.${ext}`;
    link.click();
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const stats = {
    total: queue.length,
    done: queue.filter(q => q.status === 'done').length,
    pending: queue.filter(q => q.status === 'pending').length,
    error: queue.filter(q => q.status === 'error').length,
    processing: queue.filter(q => q.status === 'processing').length,
  };

  const progressPercent = stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 font-arabic" dir="rtl">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-[#0f1115] w-full max-w-6xl h-[90vh] rounded-[2rem] border border-white/10 shadow-2xl flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/5 bg-white/5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-500/20 rounded-2xl flex items-center justify-center border border-indigo-500/30">
              <Layers className="w-6 h-6 text-indigo-400" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-white tracking-tighter">المحول الجماعي للصور</h2>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Unlimited Batch Image Converter</p>
            </div>
          </div>
          <button 
            onClick={() => { stopProcessing(); onClose(); }}
            className="w-10 h-10 bg-white/5 hover:bg-white/10 rounded-xl flex items-center justify-center text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar Settings */}
          <div className="w-80 border-l border-white/5 bg-slate-900/30 p-6 flex flex-col gap-6 overflow-y-auto custom-scrollbar">
            <div className="space-y-4">
              <h3 className="text-white font-black text-sm flex items-center gap-2">
                <Settings2 className="w-4 h-4 text-indigo-400" />
                إعدادات التحويل
              </h3>
              
              <div className="space-y-3">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">صيغة الإخراج</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'image/jpeg', label: 'JPG' },
                    { id: 'image/png', label: 'PNG' },
                    { id: 'image/webp', label: 'WebP' }
                  ].map(fmt => (
                    <button
                      key={fmt.id}
                      onClick={() => setTargetFormat(fmt.id)}
                      disabled={isProcessing}
                      className={`py-3 rounded-xl text-xs font-black transition-all ${targetFormat === fmt.id ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}
                    >
                      {fmt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3 pt-4 border-t border-white/5">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">الجودة</label>
                  <span className="text-indigo-400 font-black text-xs">{quality}%</span>
                </div>
                <input 
                  type="range" min="10" max="100" value={quality}
                  onChange={(e) => setQuality(parseInt(e.target.value))}
                  disabled={isProcessing}
                  className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                />
              </div>

              <div className="space-y-3 pt-4 border-t border-white/5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">تحويل تلقائي</label>
                  <button 
                    onClick={() => setAutoStart(!autoStart)}
                    className={`w-10 h-5 rounded-full relative transition-colors ${autoStart ? 'bg-indigo-500' : 'bg-slate-700'}`}
                  >
                    <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${autoStart ? 'left-1' : 'left-6'}`}></div>
                  </button>
                </div>
                <p className="text-[10px] text-slate-500">يبدأ التحويل فور إضافة الصور</p>
              </div>

              <div className="space-y-3 pt-4 border-t border-white/5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">تغيير المقاس</label>
                  <button 
                    onClick={() => setResizeEnabled(!resizeEnabled)}
                    disabled={isProcessing}
                    className={`w-10 h-5 rounded-full relative transition-colors ${resizeEnabled ? 'bg-indigo-500' : 'bg-slate-700'}`}
                  >
                    <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${resizeEnabled ? 'left-1' : 'left-6'}`}></div>
                  </button>
                </div>
                {resizeEnabled && (
                  <div className="animate-in fade-in slide-in-from-top-2">
                    <label className="text-[10px] text-slate-500 mb-1 block">أقصى عرض (بكسل)</label>
                    <input 
                      type="number" value={maxWidth}
                      onChange={(e) => setMaxWidth(parseInt(e.target.value) || 1920)}
                      disabled={isProcessing}
                      className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2 text-white text-sm focus:border-indigo-500 outline-none"
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="mt-auto space-y-3">
              <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-2xl p-4">
                <h4 className="text-indigo-400 font-black text-xs mb-2">معلومات المعالجة</h4>
                <ul className="space-y-2 text-[10px] text-slate-400">
                  <li className="flex justify-between"><span>الإجمالي:</span> <span className="text-white font-bold">{stats.total}</span></li>
                  <li className="flex justify-between"><span>مكتمل:</span> <span className="text-emerald-400 font-bold">{stats.done}</span></li>
                  <li className="flex justify-between"><span>قيد الانتظار:</span> <span className="text-amber-400 font-bold">{stats.pending}</span></li>
                  <li className="flex justify-between"><span>أخطاء:</span> <span className="text-red-400 font-bold">{stats.error}</span></li>
                </ul>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 flex flex-col bg-slate-950/50 relative">
            {/* Toolbar */}
            <div className="p-4 border-b border-white/5 flex items-center justify-between bg-white/5">
              <div className="flex gap-2">
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isProcessing}
                  className="px-4 py-2 bg-gradient-to-b from-slate-700 to-slate-800 hover:from-slate-600 hover:to-slate-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all border-t border-white/10 border-b-4 border-b-slate-900 active:border-b-0 active:translate-y-1 shadow-[0_4px_8px_rgba(0,0,0,0.3)] disabled:opacity-50"
                >
                  <FileImage className="w-4 h-4 drop-shadow-sm" />
                  <span className="drop-shadow-sm">إضافة صور</span>
                </button>
                <button 
                  onClick={() => folderInputRef.current?.click()}
                  disabled={isProcessing}
                  className="px-4 py-2 bg-gradient-to-b from-slate-700 to-slate-800 hover:from-slate-600 hover:to-slate-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all border-t border-white/10 border-b-4 border-b-slate-900 active:border-b-0 active:translate-y-1 shadow-[0_4px_8px_rgba(0,0,0,0.3)] disabled:opacity-50"
                >
                  <FolderUp className="w-4 h-4 drop-shadow-sm" />
                  <span className="drop-shadow-sm">إضافة مجلد</span>
                </button>
                <input 
                  type="file" ref={fileInputRef} multiple accept="image/*" className="hidden"
                  onChange={(e) => e.target.files && handleFilesAdded(e.target.files)}
                />
                <input 
                  type="file" ref={folderInputRef} 
                  {...{ webkitdirectory: "", directory: "" } as any} 
                  className="hidden"
                  onChange={(e) => e.target.files && handleFilesAdded(e.target.files)}
                />
              </div>
              
              <div className="flex gap-2">
                {stats.total > 0 && !isProcessing && stats.done < stats.total && (
                  <button 
                    onClick={startProcessing}
                    className="px-6 py-2 bg-gradient-to-b from-indigo-500 to-indigo-600 hover:from-indigo-400 hover:to-indigo-500 text-white rounded-xl text-xs font-black flex items-center gap-2 transition-all border-t border-indigo-400/50 border-b-4 border-b-indigo-800 active:border-b-0 active:translate-y-1 shadow-[0_4px_12px_rgba(99,102,241,0.3)]"
                  >
                    <Play className="w-4 h-4 fill-white drop-shadow-sm" />
                    <span className="drop-shadow-sm">بدء التحويل</span>
                  </button>
                )}
                {isProcessing && (
                  <button 
                    onClick={togglePause}
                    className="px-6 py-2 bg-gradient-to-b from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-white rounded-xl text-xs font-black flex items-center gap-2 transition-all border-t border-amber-400/50 border-b-4 border-b-amber-800 active:border-b-0 active:translate-y-1 shadow-[0_4px_12px_rgba(245,158,11,0.3)]"
                  >
                    {isPaused ? <Play className="w-4 h-4 fill-white drop-shadow-sm" /> : <Pause className="w-4 h-4 fill-white drop-shadow-sm" />}
                    <span className="drop-shadow-sm">{isPaused ? 'استكمال' : 'إيقاف مؤقت'}</span>
                  </button>
                )}
                {stats.done > 0 && !isProcessing && (
                  <button 
                    onClick={downloadAll}
                    className="px-6 py-2 bg-gradient-to-b from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white rounded-xl text-xs font-black flex items-center gap-2 transition-all border-t border-emerald-400/50 border-b-4 border-b-emerald-800 active:border-b-0 active:translate-y-1 shadow-[0_4px_12px_rgba(16,185,129,0.3)]"
                  >
                    <Download className="w-4 h-4 drop-shadow-sm" />
                    <span className="drop-shadow-sm">تحميل الكل (ZIP)</span>
                  </button>
                )}
                <button 
                  onClick={clearQueue}
                  disabled={isProcessing || queue.length === 0}
                  className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" />
                  مسح القائمة
                </button>
              </div>
            </div>

            {/* Queue List */}
            <div 
              className={`flex-1 overflow-y-auto p-6 custom-scrollbar ${isDragging ? 'bg-indigo-500/10 border-2 border-dashed border-indigo-500 m-4 rounded-2xl' : ''}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              {queue.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-500 pointer-events-none">
                  <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center mb-4">
                    <Upload className="w-10 h-10 text-slate-400" />
                  </div>
                  <h3 className="text-lg font-black text-white mb-2">اسحب وأفلت الصور هنا</h3>
                  <p className="text-sm">أو استخدم الأزرار بالأعلى لإضافة ملفات أو مجلدات كاملة</p>
                  <p className="text-xs mt-4 text-indigo-400 font-bold bg-indigo-500/10 px-4 py-2 rounded-full">يدعم عدد غير محدود من الصور</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2">
                  {queue.map((item, index) => (
                    <div key={item.id} className="bg-white/5 border border-white/5 rounded-xl p-3 flex items-center gap-4 hover:bg-white/10 transition-colors">
                      <div className="w-10 h-10 bg-slate-800 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
                        {item.resultBlob ? (
                          <img src={URL.createObjectURL(item.resultBlob)} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <ImageIcon className="w-5 h-5 text-slate-400" />
                        )}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <h4 className="text-white text-sm font-bold truncate pr-4" dir="ltr">{item.file.name}</h4>
                          <span className="text-[10px] text-slate-400 font-mono">{formatSize(item.file.size)}</span>
                        </div>
                        
                        <div className="flex items-center gap-3">
                          <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <div 
                              className={`h-full transition-all duration-300 ${
                                item.status === 'done' ? 'bg-emerald-500' : 
                                item.status === 'error' ? 'bg-red-500' : 
                                'bg-indigo-500'
                              }`}
                              style={{ width: `${item.progress}%` }}
                            />
                          </div>
                          <span className="text-[10px] font-bold w-16 text-left">
                            {item.status === 'pending' && <span className="text-slate-500">في الانتظار</span>}
                            {item.status === 'processing' && <span className="text-indigo-400">جاري...</span>}
                            {item.status === 'done' && <span className="text-emerald-400">اكتمل</span>}
                            {item.status === 'error' && <span className="text-red-400">خطأ</span>}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        {item.status === 'done' && (
                          <button 
                            onClick={() => downloadSingle(item)}
                            className="p-2 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 rounded-lg transition-colors"
                            title="تحميل"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                        )}
                        {!isProcessing && (
                          <button 
                            onClick={() => removeFile(item.id)}
                            className="p-2 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                            title="حذف"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer Progress */}
            {stats.total > 0 && (
              <div className="p-4 border-t border-white/5 bg-slate-900/80 backdrop-blur-md">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-400">التقدم الإجمالي</span>
                  <span className="text-xs font-black text-indigo-400">{progressPercent}%</span>
                </div>
                <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                  <motion.div 
                    className="h-full bg-gradient-to-r from-indigo-500 to-sky-500"
                    initial={{ width: 0 }}
                    animate={{ width: `${progressPercent}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};
