import React, { useState } from 'react';
import { Trash2, AlertTriangle, X, Loader2, CheckCircle2, Lock, KeyRound } from 'lucide-react';
import { Language, SiteSettings } from '../types';
import { deleteAllGiftsFromDb } from '../lib/firebaseService';

interface DeleteAllGiftsModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
  giftsCount: number;
  onGiftsDeleted: (deletedCount: number) => void;
  siteSettings?: SiteSettings;
}

export const DeleteAllGiftsModal: React.FC<DeleteAllGiftsModalProps> = ({
  isOpen,
  onClose,
  lang,
  giftsCount,
  onGiftsDeleted,
  siteSettings
}) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [passcode, setPasscode] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const validPass = (siteSettings?.deletePasscode || '150150').replace(/\s+/g, '');

  const handleDeleteAll = async () => {
    const cleanInput = passcode.replace(/\s+/g, '');
    
    // Check security password (e.g. 150150 or 150 150 as requested)
    if (!cleanInput) {
      setErrorMsg(
        lang === 'ar'
          ? '⚠️ يرجى إدخال كلمة سر الحماية (150150) لتأكيد الحذف.'
          : '⚠️ Please enter the security passcode to confirm deletion.'
      );
      return;
    }

    if (cleanInput !== validPass && cleanInput !== '150150') {
      setErrorMsg(
        lang === 'ar'
          ? '❌ كلمة السر غير صحيحة! كلمة السر المعتمدة هي (150150). تم إيقاف عملية الحذف لحماية البيانات.'
          : '❌ Incorrect passcode! Deletion aborted.'
      );
      return;
    }

    try {
      setIsDeleting(true);
      setErrorMsg(null);
      const count = await deleteAllGiftsFromDb();
      onGiftsDeleted(count || giftsCount);
      setPasscode('');
      onClose();
    } catch (err: any) {
      console.error('Error deleting all gifts:', err);
      setErrorMsg(
        lang === 'ar'
          ? 'حدث خطأ أثناء محاولة حذف المنتجات من قاعدة البيانات'
          : 'Failed to delete all gifts from database'
      );
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/85 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-md rounded-3xl bg-[#121520] border border-red-900/60 shadow-2xl p-6 sm:p-7 overflow-hidden text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          disabled={isDeleting}
          className="absolute top-4 right-4 p-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-700/60 transition-colors disabled:opacity-50 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Warning Icon & Title */}
        <div className="flex items-center gap-3.5 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-400 shrink-0 shadow-lg shadow-red-500/20">
            <AlertTriangle className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-black text-white">
              {lang === 'ar' ? 'حذف جميع المنتجات المرفوعة' : 'Delete All Uploaded Products'}
            </h3>
            <span className="text-xs text-red-400 font-semibold">
              {lang === 'ar' ? `سيتم حذف (${giftsCount}) هدية ومنتج نهائياً` : `Will delete (${giftsCount}) products permanently`}
            </span>
          </div>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 rounded-xl bg-red-950/80 border border-red-800 text-red-300 text-xs font-semibold leading-relaxed">
            {errorMsg}
          </div>
        )}

        <div className="space-y-3 text-xs text-slate-300 leading-relaxed mb-4">
          <div className="p-3.5 rounded-2xl bg-red-950/40 border border-red-900/50 space-y-2">
            <p className="font-bold text-red-200">
              {lang === 'ar'
                ? '⚠️ تحذير أمني: هذا الإجراء سيقوم بحذف جميع المنتجات وإفراغ المتجر بالكامل!'
                : '⚠️ Security Warning: This action will permanently erase all uploaded products!'}
            </p>
            <p className="text-slate-400 text-[11px]">
              {lang === 'ar'
                ? 'لحماية المتجر من الحذف العشوائي أو بالخطأ، يتطلب الإجراء كتابة كلمة سر الحماية.'
                : 'To prevent accidental deletion, entering the security passcode is required.'}
            </p>
          </div>
        </div>

        {/* Passcode Security Input */}
        <div className="space-y-1.5 mb-6">
          <label className="block text-xs font-bold text-slate-200 flex items-center gap-1.5">
            <KeyRound className="w-4 h-4 text-amber-400" />
            <span>{lang === 'ar' ? 'كلمة سر الحماية لتأكيد الحذف:' : 'Security Passcode to confirm:'}</span>
          </label>
          <div className="relative">
            <input
              type="text"
              value={passcode}
              onChange={(e) => {
                setPasscode(e.target.value);
                setErrorMsg(null);
              }}
              placeholder={lang === 'ar' ? 'اكتب كلمة السر هنا (مثال: 150 150)' : 'Enter passcode (e.g. 150 150)'}
              className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-red-500/50 text-sm text-white font-mono placeholder:text-slate-600 focus:outline-none focus:border-red-400 text-center tracking-widest font-bold shadow-inner"
              autoFocus
            />
          </div>
          <p className="text-[11px] text-slate-400 text-center">
            {lang === 'ar' ? 'كلمة السر المعتمدة للحذف: ' : 'Passcode: '}
            <span className="font-mono text-amber-400 font-bold">150 150</span>
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800/80">
          <button
            type="button"
            onClick={() => {
              setPasscode('');
              setErrorMsg(null);
              onClose();
            }}
            disabled={isDeleting}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer"
          >
            {lang === 'ar' ? 'إلغاء' : 'Cancel'}
          </button>

          <button
            type="button"
            onClick={handleDeleteAll}
            disabled={isDeleting || giftsCount === 0}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 text-white font-black text-xs shadow-lg shadow-red-600/30 flex items-center gap-2 disabled:opacity-50 cursor-pointer active:scale-95 transition-all"
          >
            {isDeleting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
            <span>
              {isDeleting
                ? (lang === 'ar' ? 'جارِ التحقق والحذف...' : 'Deleting...')
                : (lang === 'ar' ? `تأكيد وحذف (${giftsCount}) منتج` : `Delete All (${giftsCount})`)}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
