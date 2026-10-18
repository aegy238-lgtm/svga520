import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, addDoc, updateDoc, doc, Timestamp } from 'firebase/firestore';
import { StoreProduct, PRODUCT_CATEGORIES } from '../types';
import { Upload, X, Save, Sparkles, FileCode2, Image as ImageIcon, Video, Check, Trash2, AlertCircle } from 'lucide-react';
import { CentralUploadService } from '../services/centralUploadService';
import { saveLocalGiftFile } from './giftIndexedDB';

const ALL_GIFT_FORMATS = [
  'SVGA', 'VAP', 'PAG', 'Lottie', 'DotLottie', 
  'MP4', 'WebM', 'MOV', 'GIF', 'WebP', 'APNG', 
  'PNG Sequence', 'ZIP', 'AEP'
];

interface GiftUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingProduct?: StoreProduct | null;
  onSaved?: () => void;
}

export const GiftUploadModal: React.FC<GiftUploadModalProps> = ({
  isOpen,
  onClose,
  editingProduct,
  onSaved
}) => {
  const [name, setName] = useState('');
  const [price, setPrice] = useState<number>(15);
  const [category, setCategory] = useState('هدايا SVGA و VAP');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [supportedFormats, setSupportedFormats] = useState<string[]>(['SVGA', 'VAP', 'WEBP']);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (editingProduct) {
      setName(editingProduct.name || '');
      setPrice(editingProduct.price || 15);
      setCategory(editingProduct.category || 'هدايا SVGA و VAP');
      setDescription(editingProduct.description || '');
      setImageUrl(editingProduct.imageUrl || '');
      setVideoUrl(editingProduct.videoUrl || '');
      setSupportedFormats(editingProduct.supportedFormats || ['SVGA', 'VAP', 'WEBP']);
    } else {
      setName('');
      setPrice(15);
      setCategory('هدايا SVGA و VAP');
      setDescription('');
      setImageUrl('');
      setVideoUrl('');
      setSupportedFormats(['SVGA', 'VAP', 'WEBP']);
    }
    setErrorMsg('');
  }, [editingProduct, isOpen]);

  if (!isOpen) return null;

  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processSelectedFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processSelectedFile(e.target.files[0]);
    }
  };

  const processSelectedFile = (selectedFile: File) => {
    setFile(selectedFile);
    setErrorMsg('');
    const fileName = selectedFile.name;
    const ext = fileName.split('.').pop()?.toLowerCase() || '';

    // Auto-fill gift title if empty
    if (!name.trim()) {
      const cleanName = fileName.substring(0, fileName.lastIndexOf('.')) || fileName;
      setName(cleanName.replace(/[_-]/g, ' '));
    }

    // Auto-detect format tags
    let fmt = 'SVGA';
    if (ext === 'svga') fmt = 'SVGA';
    else if (ext === 'vap') fmt = 'VAP';
    else if (ext === 'pag') fmt = 'PAG';
    else if (ext === 'json' || ext === 'lottie' || ext === 'dotlottie') fmt = 'Lottie';
    else if (ext === 'mp4') fmt = 'MP4';
    else if (ext === 'webm') fmt = 'WebM';
    else if (ext === 'mov') fmt = 'MOV';
    else if (ext === 'gif') fmt = 'GIF';
    else if (ext === 'webp') fmt = 'WebP';
    else if (ext === 'apng') fmt = 'APNG';
    else if (ext === 'aep') fmt = 'AEP';
    else if (ext === 'zip') fmt = 'ZIP';

    if (!supportedFormats.includes(fmt)) {
      setSupportedFormats(prev => Array.from(new Set([...prev, fmt])));
    }

    // Auto-detect category
    if (fileName.includes('إطار') || fileName.includes('frame')) {
      setCategory('إطارات متحركة وثابتة');
    } else if (fileName.includes('VIP') || fileName.includes('شارة') || fileName.includes('رتبة')) {
      setCategory('أيقونات VIP والشارات');
    } else if (fileName.includes('فقاعة') || fileName.includes('chat')) {
      setCategory('فقاعات الدردشة والمؤثرات');
    } else if (fileName.includes('دخولية') || fileName.includes('سيارة') || fileName.includes('car')) {
      setCategory('دخوليات ورتب');
    } else if (fileName.includes('تأثير') || fileName.includes('لمعان')) {
      setCategory('تأثيرات اللمعان والمؤثرات');
    }

    // Generate local Object URL for instant preview if image/video
    const objectUrl = URL.createObjectURL(selectedFile);
    if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(ext)) {
      setImageUrl(objectUrl);
    } else if (['mp4', 'webm', 'mov'].includes(ext)) {
      setVideoUrl(objectUrl);
    }
  };

  const toggleFormat = (fmt: string) => {
    if (supportedFormats.includes(fmt)) {
      setSupportedFormats(supportedFormats.filter(f => f !== fmt));
    } else {
      setSupportedFormats([...supportedFormats, fmt]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('يرجى إدخال اسم الهدية/المنتج');
      return;
    }

    setUploading(true);
    setErrorMsg('');

    try {
      let finalImageUrl = imageUrl;
      let finalVideoUrl = videoUrl;

      // If a file is selected, store in IndexedDB and generate safe IDB reference
      let fileKey = editingProduct?.id || `gift_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      if (file) {
        const ext = (file.name.split('.').pop() || '').toLowerCase();
        
        // Save file in local IndexedDB for instant, unlimited-size persistence
        const idbRef = await saveLocalGiftFile(fileKey, file);
        const objectBlobUrl = URL.createObjectURL(file);

        if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(ext)) {
          finalImageUrl = idbRef || objectBlobUrl;
        } else {
          finalVideoUrl = idbRef || objectBlobUrl;
          if (!finalImageUrl) finalImageUrl = '/logo.png';
        }
      }

      // Safety check: Never allow string properties longer than 500,000 characters in Firestore payload
      if (finalImageUrl && finalImageUrl.length > 500000) {
        const imgKey = `${fileKey}_img`;
        await saveLocalGiftFile(imgKey, finalImageUrl);
        finalImageUrl = `idb://${imgKey}`;
      }
      if (finalVideoUrl && finalVideoUrl.length > 500000) {
        const vidKey = `${fileKey}_vid`;
        await saveLocalGiftFile(vidKey, finalVideoUrl);
        finalVideoUrl = `idb://${vidKey}`;
      }

      const productPayload = {
        name: name.trim(),
        price: Number(price) || 0,
        category: category || 'هدايا SVGA و VAP',
        description: description.trim() || 'تصميم هدية واحتياجات متحركة عالية الجودة.',
        imageUrl: finalImageUrl || '/logo.png',
        videoUrl: finalVideoUrl || '',
        supportedFormats: supportedFormats.length > 0 ? supportedFormats : ['SVGA', 'VAP', 'WEBP'],
        updatedAt: Timestamp.now()
      };

      let savedDocRefId = editingProduct?.id;
      if (editingProduct?.id) {
        // Update existing product in Firestore
        await updateDoc(doc(db, 'products', editingProduct.id), productPayload);
      } else {
        // Create new product in Firestore
        const docRef = await addDoc(collection(db, 'products'), {
          ...productPayload,
          createdAt: Timestamp.now()
        });
        savedDocRefId = docRef.id;
      }

      // Non-blocking background cloud upload
      if (file && savedDocRefId) {
        const docIdToUpdate = savedDocRefId;
        CentralUploadService.uploadFile(file, {
          uploadContext: 'store_product',
          customName: name
        }).then(async (uploadedRecord) => {
          if (uploadedRecord?.downloadUrl) {
            const ext = (file.name.split('.').pop() || '').toLowerCase();
            const updateObj: Record<string, any> = {};
            if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(ext)) {
              updateObj.imageUrl = uploadedRecord.downloadUrl;
            } else {
              updateObj.videoUrl = uploadedRecord.downloadUrl;
            }
            await updateDoc(doc(db, 'products', docIdToUpdate), updateObj).catch(() => {});
          }
        }).catch((e) => {
          console.warn("Background cloud upload notice:", e);
        });
      }

      setUploading(false);
      if (onSaved) onSaved();
      onClose();
    } catch (err: any) {
      console.error("Error saving gift product:", err);
      setErrorMsg(err?.message || 'حدث خطأ أثناء حفظ الهدية، يرجى المحاولة مرة أخرى.');
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[2000] bg-slate-950/80 backdrop-blur-xl flex items-center justify-center p-4 overflow-y-auto dir-rtl" dir="rtl">
      <div className="bg-slate-900 border border-indigo-500/30 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden my-auto animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-indigo-950/80 via-purple-950/80 to-slate-950 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/30">
              <Sparkles className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h2 className="text-base font-black text-white">
                {editingProduct ? 'تعديل بيانات الهدية / المنتج' : 'رفع وإضافة هدية جديدة للمتجر 🎁'}
              </h2>
              <p className="text-[11px] text-slate-400">
                يدعم صيغ SVGA, VAP, MP4, PAG, Lottie, PNG, GIF, ZIP, AEP وغيرها
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            type="button"
            className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto custom-scrollbar">
          
          {errorMsg && (
            <div className="p-3.5 rounded-2xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* File Dropzone */}
          <div 
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleFileDrop}
            className="border-2 border-dashed border-indigo-500/40 hover:border-indigo-400 bg-slate-950/60 hover:bg-indigo-950/20 rounded-2xl p-6 transition-all text-center relative cursor-pointer group"
          >
            <input 
              type="file" 
              onChange={handleFileInput}
              accept=".svga,.vap,.pag,.json,.lottie,.dotlottie,.mp4,.webm,.mov,.gif,.webp,.apng,.png,.jpg,.zip,.aep,*/*" 
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            />
            <div className="flex flex-col items-center justify-center gap-2 pointer-events-none">
              <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 group-hover:bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-indigo-400 group-hover:scale-110 transition-transform">
                <Upload className="w-6 h-6" />
              </div>
              <div className="text-xs font-bold text-slate-200">
                {file ? (
                  <span className="text-amber-300 font-mono">تم اختيار: {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
                ) : (
                  <span>اسحب ملف الهدية هنا أو انقر للاختيار من جهازك</span>
                )}
              </div>
              <div className="text-[10px] text-slate-400 flex flex-wrap justify-center gap-1 max-w-md">
                {ALL_GIFT_FORMATS.map(f => (
                  <span key={f} className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[9px]">
                    .{f.toLowerCase()}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Live Video / Image Preview Card if available */}
          {(videoUrl || imageUrl) && (
            <div className="p-3.5 rounded-2xl bg-slate-950 border border-white/10 flex flex-col items-center gap-2 relative">
              <div className="text-[11px] font-bold text-slate-400 w-full flex items-center justify-between border-b border-white/5 pb-1.5">
                <span>معاينة الهدية / الفيديو 🎬</span>
                {videoUrl && <span className="text-amber-300 font-mono text-[10px]">اضغط على الفيديو للتشغيل أو الإيقاف</span>}
              </div>
              {videoUrl ? (
                <video 
                  src={videoUrl} 
                  controls 
                  autoPlay 
                  loop 
                  muted 
                  playsInline 
                  className="max-h-48 w-full rounded-xl object-contain bg-black/60 border border-white/10"
                />
              ) : imageUrl ? (
                <img 
                  src={imageUrl} 
                  alt="Gift preview" 
                  className="max-h-48 rounded-xl object-contain bg-black/60 border border-white/10"
                />
              ) : null}
            </div>
          )}

          {/* Fields Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* Name */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                اسم الهدية / المنتج *
              </label>
              <input 
                type="text" 
                value={name} 
                onChange={e => setName(e.target.value)}
                placeholder="مثال: إطار النسر الذهبي VIP" 
                className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                required
              />
            </div>

            {/* Price */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                السعر ($USD)
              </label>
              <input 
                type="number" 
                min="0"
                step="1"
                value={price} 
                onChange={e => setPrice(Number(e.target.value))}
                placeholder="15" 
                className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-amber-300 font-bold focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Category */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                تصنيف الهدية
              </label>
              <select 
                value={category} 
                onChange={e => setCategory(e.target.value)}
                className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                {PRODUCT_CATEGORIES.filter(c => c !== 'الكل').map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            {/* Image Preview URL */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                رابط صورة المعاينة (Poster Image)
              </label>
              <input 
                type="text" 
                value={imageUrl} 
                onChange={e => setImageUrl(e.target.value)}
                placeholder="https://... / صورة الهدية" 
                className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Video / SVGA URL */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                رابط ملف الأنيميشن أو الفيديو (SVGA / VAP / MP4 URL)
              </label>
              <input 
                type="text" 
                value={videoUrl} 
                onChange={e => setVideoUrl(e.target.value)}
                placeholder="https://... / رابط التحميل أو المعاينة" 
                className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Formats Tags Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-2">
              الصيغ المدعومة المتوفرة في الهدية:
            </label>
            <div className="flex flex-wrap gap-1.5">
              {ALL_GIFT_FORMATS.map(fmt => {
                const isSelected = supportedFormats.includes(fmt);
                return (
                  <button
                    key={fmt}
                    type="button"
                    onClick={() => toggleFormat(fmt)}
                    className={`px-3 py-1 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center gap-1 ${
                      isSelected
                        ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white border-indigo-400 shadow-md'
                        : 'bg-slate-950 text-slate-400 hover:text-white border-white/10'
                    }`}
                  >
                    {isSelected && <Check className="w-3 h-3 text-amber-300 shrink-0" />}
                    <span>{fmt}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">
              وصف وتفاصيل الهدية
            </label>
            <textarea 
              rows={2}
              value={description} 
              onChange={e => setDescription(e.target.value)}
              placeholder="اكتب وصفاً مختصراً عن الهدية أو أبعادها وميزاتها..." 
              className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-indigo-500 resize-none"
            />
          </div>

          {/* Action Footer */}
          <div className="pt-2 border-t border-white/10 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={uploading}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-black shadow-lg shadow-indigo-500/30 flex items-center gap-2 cursor-pointer transition-all active:scale-95 disabled:opacity-50"
            >
              <Save className="w-4 h-4 text-amber-300" />
              <span>{uploading ? `جاري الحفظ والرفع (${uploadProgress}%)...` : (editingProduct ? 'حفظ التعديلات' : 'إضافة الهدية للمتجر')}</span>
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};
