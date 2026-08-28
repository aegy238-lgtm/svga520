import React, { useState } from 'react';
import { Download, RefreshCw } from 'lucide-react';
import JSZip from 'jszip';
import { UserRecord } from '../types';

interface AnimationEditorProps {
  currentUser: UserRecord | null;
  onCancel: () => void;
  onSubscriptionRequired: () => void;
}

export const AnimationEditor: React.FC<AnimationEditorProps> = ({ currentUser, onCancel }) => {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);

  const processSVGA = async (uploadedFile: File) => {
    setFile(uploadedFile);
    setIsProcessing(true);
    setProgress(10);
    try {
      // Basic fallback SVGA extractor using JSZip!
      // In real SVGA we would parse the protobuf, but since we just need to get the images:
      const zip = new JSZip();
      const content = await zip.loadAsync(uploadedFile);
      const outputZip = new JSZip();
      
      let imgCount = 0;
      for (const [filename, fileData] of Object.entries(content.files)) {
        if (!fileData.dir && (filename.endsWith('.png') || filename.endsWith('.jpg') || filename.endsWith('.jpeg'))) {
           const blob = await fileData.async('blob');
           outputZip.file(filename, blob);
           imgCount++;
        }
      }
      setProgress(50);
      
      if (imgCount === 0) {
        alert("لا توجد صور قابلة للاستخراج داخل هذا الملف.");
      } else {
        const outBlob = await outputZip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(outBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${uploadedFile.name}_extracted_images.zip`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch(e) {
       console.error("Failed to extract:", e);
       alert("فشل في معالجة الملف واستخراج الصور. تأكد من أن الملف يدعم الاستخراج (SVGA).");
    } finally {
      setIsProcessing(false);
      setProgress(100);
    }
  };

  return (
    <div className="min-h-screen bg-[#0E0F14] text-white flex flex-col font-sans overflow-hidden">
        <nav className="flex items-center justify-between px-6 py-4 bg-[#0E0F14]/80 backdrop-blur-md border-b justify-center items-center relative z-20" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
            <div className="absolute pl-4 flex items-center gap-2 cursor-pointer transition select-none hover:opacity-80" onClick={onCancel} style={{left:0}}>
            <div className="w-8 h-8 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-600/20">
                <RefreshCw className="w-4 h-4 text-white" />
            </div>
            <span className="font-black text-xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60">رجوع للمنصة</span>
            </div>
            <h2 className="text-xl font-bold font-arabic">مفكك ومستخرج صور SVGA (Animation Editor)</h2>
        </nav>
        <div className="flex-1 flex flex-col items-center justify-center p-8">
            <div className="max-w-xl w-full bg-slate-900 border border-white/10 rounded-3xl p-8 text-center shadow-2xl">
                <h3 className="text-2xl font-black mb-4">أداة استخراج الصور (Animation Editor)</h3>
                <p className="text-slate-400 mb-8 font-arabic" dir="rtl">
                    قم برفع ملف SVGA الخاص بك هنا. ستقوم الأداة بتفكيك الملف واستخراج جميع الصور الموجودة بداخله (Asset Images) وتحميلها في ملف ZIP.
                </p>
                <div 
                    className="border-2 border-dashed border-purple-500/50 rounded-2xl h-48 flex items-center justify-center cursor-pointer hover:bg-purple-500/10 transition-colors"
                >
                    <input 
                        type="file" 
                        accept=".svga" 
                        onChange={(e) => {
                            if (e.target.files && e.target.files.length > 0) {
                                processSVGA(e.target.files[0]);
                            }
                        }}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                    />
                    <div className="flex flex-col items-center pointer-events-none">
                        <Download className="w-12 h-12 text-purple-400 mb-4" />
                        <span className="text-purple-300 font-bold">اسحب أو انقر لرفع ملف SVGA</span>
                    </div>
                </div>
                {isProcessing && (
                    <div className="mt-6">
                        <div className="w-full bg-slate-800 rounded-full h-2 mb-2">
                            <div className="bg-purple-500 h-2 rounded-full" style={{width: `${progress}%`}}></div>
                        </div>
                        <span className="text-xs text-purple-300">جاري الاستخراج... {progress}%</span>
                    </div>
                )}
            </div>
        </div>
    </div>
  );
};
