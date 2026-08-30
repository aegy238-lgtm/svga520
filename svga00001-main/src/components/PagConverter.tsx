import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Upload, X, FileArchive, Layers, Play, Download, 
  Settings2, Trash2, RefreshCw, Image as ImageIcon, FileJson
} from 'lucide-react';

import JSZip from 'jszip';
import pako from 'pako';
import { parse } from 'protobufjs';

// Inline SVGA schema to avoid import issues during build
const svgaSchema = `
syntax = "proto3";
package com.opensource.svga;

message MovieParams {
  float viewBoxWidth = 1;
  float viewBoxHeight = 2;
  int32 fps = 3;
  int32 frames = 4;
}

message SpriteEntity {
  string imageKey = 1;
  repeated FrameEntity frames = 2;
  string matteKey = 3;
}

message AudioEntity {
  string audioKey = 1;
  int32 startFrame = 2;
  int32 endFrame = 3;
  int32 startTime = 4;
  int32 totalTime = 5;
}

message Layout {
  float x = 1;
  float y = 2;
  float width = 3;
  float height = 4;
}

message Transform {
  float a = 1;
  float b = 2;
  float c = 3;
  float d = 4;
  float tx = 5;
  float ty = 6;
}

message ShapeEntity {
  enum ShapeType {
    SHAPE = 0;
    RECT = 1;
    ELLIPSE = 2;
    KEEP = 3;
  }
  message ShapeArgs {
    string d = 1;
  }
  message RectArgs {
    float x = 1;
    float y = 2;
    float width = 3;
    float height = 4;
    float cornerRadius = 5;
  }
  message EllipseArgs {
    float x = 1;
    float y = 2;
    float radiusX = 3;
    float radiusY = 4;
  }
  message ShapeStyle {
    message RGBAColor {
      float r = 1;
      float g = 2;
      float b = 3;
      float a = 4;
    }
    RGBAColor fill = 1;
    RGBAColor stroke = 2;
    float strokeWidth = 3;
    enum LineCap {
      LineCap_BUTT = 0;
      LineCap_ROUND = 1;
      LineCap_SQUARE = 2;
    }
    LineCap lineCap = 4;
    enum LineJoin {
      LineJoin_MITER = 0;
      LineJoin_ROUND = 1;
      LineJoin_BEVEL = 2;
    }
    LineJoin lineJoin = 5;
    float miterLimit = 6;
    float lineDashI = 7;
    float lineDashII = 8;
    float lineDashIII = 9;
  }
  ShapeType type = 1;
  ShapeArgs shape = 2;
  RectArgs rect = 3;
  EllipseArgs ellipse = 4;
  ShapeStyle styles = 10;
  Transform transform = 11;
}

message FrameEntity {
  float alpha = 1;
  Layout layout = 2;
  Transform transform = 3;
  string clipPath = 4;
  repeated ShapeEntity shapes = 5;
}

message MovieEntity {
  string version = 1;
  MovieParams params = 2;
  map<string, bytes> images = 3;
  repeated SpriteEntity sprites = 4;
  repeated AudioEntity audios = 5;
}
`;

type FileStatus = 'pending' | 'processing' | 'done' | 'error';

interface QueuedFile {
  id: string;
  file: File;
  status: FileStatus;
  progress: number;
  resultBlob?: Blob;
  extractedLayers?: { name: string, url: string }[];
  error?: string;
}

interface PagConverterProps {
  onClose: () => void;
}

export const PagConverter: React.FC<PagConverterProps> = ({ onClose }) => {
  const [queue, setQueue] = useState<QueuedFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const processingRef = useRef(false);
  const queueRef = useRef<QueuedFile[]>([]);

  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);

  const handleFilesAdded = (files: FileList | File[]) => {
    const validExtensions = ['.svga'];
    
    const newItems: QueuedFile[] = Array.from(files)
      .filter(file => validExtensions.some(ext => file.name.toLowerCase().endsWith(ext)))
      .map(file => ({
        id: Math.random().toString(36).substring(7) + Date.now(),
        file,
        status: 'pending',
        progress: 0
      }));
    
    if (newItems.length !== files.length) {
      alert(`يرجى اختيار ملفات بصيغة ${validExtensions.join(' أو ')} فقط.`);
    }

    setQueue(prev => [...prev, ...newItems]);
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

  // Simulated processing since actual SVGA->PAG encoding requires a backend or WASM encoder
  const processNext = async () => {
    if (!processingRef.current) return;

    const pendingIndex = queueRef.current.findIndex(q => q.status === 'pending');
    
    if (pendingIndex === -1) {
      setIsProcessing(false);
      processingRef.current = false;
      return;
    }

    const item = queueRef.current[pendingIndex];
    
    // Update status to processing
    const updateItem = (updates: Partial<QueuedFile>) => {
      queueRef.current[pendingIndex] = { ...queueRef.current[pendingIndex], ...updates };
      setQueue([...queueRef.current]);
    };

    updateItem({ status: 'processing', progress: 10 });

    try {
      if (item.file.name.toLowerCase().endsWith('.svga')) {
        const arrayBuffer = await item.file.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        
        updateItem({ progress: 30 });
        
        let inflated;
        try {
            inflated = pako.inflate(uint8Array);
        } catch (e) {
            inflated = uint8Array;
        }
        
        updateItem({ progress: 50 });
        
        const root = parse(svgaSchema).root;
        const MovieEntity = root.lookupType("com.opensource.svga.MovieEntity");
        const message = MovieEntity.decode(inflated) as any;
        
        updateItem({ progress: 80 });

        const extractedLayers: { name: string, url: string }[] = [];
        
        if (message.images) {
           const imageKeys = Object.keys(message.images);
           for (const key of imageKeys) {
               const data = message.images[key];
               let base64Data = "";
               if (data instanceof Uint8Array) {
                   // Convert Uint8Array to base64
                   let binary = '';
                   const len = data.byteLength;
                   for (let i = 0; i < len; i++) {
                       binary += String.fromCharCode(data[i]);
                   }
                   base64Data = btoa(binary);
               } else if (typeof data === 'string') {
                   base64Data = data;
               }
               
               if (base64Data) {
                   extractedLayers.push({
                       name: `${key}.png`,
                       url: `data:image/png;base64,${base64Data}`
                   });
               }
           }
        }

        // Extract metadata
        const metadata = {
            version: message.version,
            params: message.params,
            spritesCount: message.sprites?.length || 0,
            audiosCount: message.audios?.length || 0
        };

        extractedLayers.push({
            name: 'data.json',
            url: 'data:application/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(metadata, null, 2))
        });

        updateItem({ 
          status: 'done', 
          progress: 100, 
          extractedLayers: extractedLayers 
        });
      } else {
        throw new Error('صيغة الملف غير مدعومة للاستخراج. يرجى رفع ملف SVGA.');
      }
    } catch (error: any) {
      updateItem({ status: 'error', error: error.message });
    }

    processNext();
  };

  const startProcessing = () => {
    if (queueRef.current.filter(q => q.status === 'pending').length === 0) return;
    setIsProcessing(true);
    processingRef.current = true;
    processNext();
  };

  const stopProcessing = () => {
    setIsProcessing(false);
    processingRef.current = false;
    setQueue(prev => prev.map(item => item.status === 'processing' ? { ...item, status: 'pending', progress: 0 } : item));
  };

  const downloadResult = async (item: QueuedFile) => {
    if (item.extractedLayers) {
      // Create a ZIP file containing the layers
      if (typeof JSZip === 'undefined') {
        alert('مكتبة JSZip غير متوفرة. يرجى المحاولة لاحقاً.');
        return;
      }
      
      const zip = new JSZip();
      const folder = zip.folder(item.file.name.replace(/\.[^/.]+$/, "_layers"));
      
      for (const layer of item.extractedLayers) {
        if (layer.url.startsWith('data:')) {
          if (layer.url.includes(';base64,')) {
            const base64Data = layer.url.split(',')[1];
            folder?.file(layer.name, base64Data, { base64: true });
          } else {
            const data = decodeURIComponent(layer.url.split(',')[1]);
            folder?.file(layer.name, data);
          }
        } else {
          try {
            const response = await fetch(layer.url);
            const blob = await response.blob();
            folder?.file(layer.name, blob);
          } catch (e) {
            console.error('Failed to fetch layer image', e);
          }
        }
      }
      
      const content = await zip.generateAsync({ type: "blob" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(content);
      link.download = `${item.file.name.replace(/\.[^/.]+$/, "_layers")}.zip`;
      link.click();
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 font-arabic" dir="rtl">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-[#0f1115] w-full max-w-5xl h-[85vh] rounded-[2rem] border border-white/10 shadow-2xl flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/5 bg-white/5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-purple-500/20 rounded-2xl flex items-center justify-center border border-purple-500/30">
              <FileArchive className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-white tracking-tighter">أدوات SVGA</h2>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">SVGA Layer Extractor</p>
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
          <div className="w-72 border-l border-white/5 bg-slate-900/30 p-6 flex flex-col gap-6 overflow-y-auto custom-scrollbar">
            <div className="space-y-4">
              <h3 className="text-white font-black text-sm flex items-center gap-2">
                <Settings2 className="w-4 h-4 text-purple-400" />
                وضع التشغيل
              </h3>
              
              <div className="space-y-3">
                <button
                  disabled={true}
                  className="w-full p-4 rounded-2xl border-2 text-right transition-all bg-blue-500/10 border-blue-500 text-white"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <Layers className="w-5 h-5 text-blue-400" />
                    <span className="font-bold">استخراج طبقات SVGA</span>
                  </div>
                  <p className="text-[10px] opacity-70 leading-relaxed">
                    استخراج الصور والطبقات المتسلسلة من ملفات SVGA وتصديرها كملف ZIP.
                  </p>
                </button>
              </div>
            </div>

            <div className="mt-auto">
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                <h4 className="text-white font-bold text-xs mb-2">معلومات</h4>
                <p className="text-[10px] text-slate-400 leading-relaxed">
                  هذه الأداة تتيح لك استخراج جميع الصور والطبقات المخفية من ملفات SVGA وتصديرها كملف ZIP واحد.
                </p>
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
                  <Upload className="w-4 h-4 drop-shadow-sm" />
                  <span className="drop-shadow-sm">إضافة ملفات SVGA</span>
                </button>
                <input 
                  type="file" ref={fileInputRef} multiple 
                  accept=".svga" 
                  className="hidden"
                  onChange={(e) => e.target.files && handleFilesAdded(e.target.files)}
                />
              </div>
              
              <div className="flex gap-2">
                {queue.length > 0 && !isProcessing && queue.some(q => q.status === 'pending') && (
                  <button 
                    onClick={startProcessing}
                    className="px-6 py-2 text-white rounded-xl text-xs font-black flex items-center gap-2 transition-all shadow-[0_4px_12px_rgba(37,99,235,0.3)] bg-gradient-to-b from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 border-t border-blue-400/50 border-b-4 border-b-blue-800 active:border-b-0 active:translate-y-1"
                  >
                    <Play className="w-4 h-4 fill-white drop-shadow-sm" />
                    <span className="drop-shadow-sm">بدء الاستخراج</span>
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
              className={`flex-1 overflow-y-auto p-6 custom-scrollbar ${isDragging ? 'bg-purple-500/10 border-2 border-dashed border-purple-500 m-4 rounded-2xl' : ''}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              {queue.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-500 pointer-events-none">
                  <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center mb-4">
                    <Layers className="w-10 h-10 text-slate-400" />
                  </div>
                  <h3 className="text-lg font-black text-white mb-2">اسحب وأفلت الملفات هنا</h3>
                  <p className="text-sm">
                    قم بإسقاط ملفات SVGA لاستخراج الطبقات منها
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {queue.map((item) => (
                    <div key={item.id} className="bg-white/5 border border-white/5 rounded-xl p-4 flex items-center gap-4 hover:bg-white/10 transition-colors">
                      <div className="w-12 h-12 bg-slate-800 rounded-xl flex items-center justify-center flex-shrink-0">
                        <Layers className="w-6 h-6 text-blue-400" />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-white text-sm font-bold truncate pr-4" dir="ltr">{item.file.name}</h4>
                          <span className="text-[10px] text-slate-400 font-mono">{formatSize(item.file.size)}</span>
                        </div>
                        
                        <div className="flex items-center gap-3">
                          <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                            <div 
                              className={`h-full transition-all duration-300 ${
                                item.status === 'done' ? 'bg-emerald-500' : 
                                item.status === 'error' ? 'bg-red-500' : 
                                'bg-blue-500'
                              }`}
                              style={{ width: `${item.progress}%` }}
                            />
                          </div>
                          <span className="text-xs font-bold w-20 text-left">
                            {item.status === 'pending' && <span className="text-slate-500">في الانتظار</span>}
                            {item.status === 'processing' && <span className="text-blue-400">{item.progress}%</span>}
                            {item.status === 'done' && <span className="text-emerald-400">اكتمل</span>}
                            {item.status === 'error' && <span className="text-red-400">خطأ</span>}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        {item.status === 'done' && (
                          <button 
                            onClick={() => downloadResult(item)}
                            className="px-4 py-2 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 rounded-lg text-xs font-bold transition-colors flex items-center gap-2"
                          >
                            <Download className="w-4 h-4" />
                            تحميل الطبقات (ZIP)
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
          </div>
        </div>
      </motion.div>
    </div>
  );
};
