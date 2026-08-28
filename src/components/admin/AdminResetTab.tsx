import React, { useState } from 'react';
import { db, auth } from '../../firebase';
import { doc, updateDoc, setDoc, deleteDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { RefreshCw, AlertTriangle, ShieldAlert } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export default function AdminResetTab() {
  const { user } = useAuth();
  const [isResetting, setIsResetting] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  const handleReset = async () => {
    if (!user) return;
    if (confirmText !== 'RESET') return alert('الرجاء كتابة RESET للتأكيد');
    
    setIsResetting(true);
    try {
      const userRef = doc(db, 'users', user.uid);
      
      // Reset user data
      await updateDoc(userRef, {
        displayName: 'المدير العام',
        photoURL: '',
        diamonds: 0,
        totalSpent: 0,
        totalSupport: 0,
        rechargeLevel: 1,
        supportLevel: 1,
        ownedItems: [],
        activeFrame: null,
        activeEntrance: null,
        updatedAt: new Date().toISOString()
      });

      // Optional: Delete user's rooms or other data if needed
      // For now just reset the profile fields as requested
      
      alert('تم إعادة تعيين الحساب بنجاح! سيتم تحديث البيانات تلقائياً.');
      setConfirmText('');
    } catch (error: any) {
      alert('خطأ في إعادة التعيين: ' + error.message);
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="bg-red-50 border border-red-100 p-6 rounded-2xl shadow-sm">
        <div className="flex items-center gap-3 text-red-600 mb-4">
          <ShieldAlert size={32} />
          <h2 className="text-xl font-bold">منطقة الخطر: إعادة تعيين حساب المدير</h2>
        </div>
        
        <p className="text-gray-700 mb-6 leading-relaxed">
          هذا الإجراء سيقوم بحذف جميع بيانات حسابك الحالي (الصورة الشخصية، الإطارات، الدخوليات، الألماس، والمستويات) وإرجاعها إلى الصفر. 
          <br />
          <strong className="text-red-600">هذا الإجراء لا يمكن التراجع عنه!</strong>
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              اكتب كلمة <span className="text-red-600 font-black">RESET</span> للتأكيد:
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className="w-full p-3 border border-red-200 rounded-xl focus:ring-2 focus:ring-red-500 outline-none font-mono text-center uppercase"
              placeholder="RESET"
            />
          </div>

          <button
            onClick={handleReset}
            disabled={isResetting || confirmText !== 'RESET'}
            className="w-full bg-red-600 text-white py-4 rounded-xl font-bold hover:bg-red-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-red-500/20"
          >
            {isResetting ? (
              <RefreshCw className="animate-spin" size={20} />
            ) : (
              <RefreshCw size={20} />
            )}
            إعادة تعيين الحساب الآن
          </button>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl flex items-start gap-3 text-blue-700 text-sm">
        <AlertTriangle className="shrink-0 mt-0.5" size={18} />
        <p>
          ملاحظة: سيتم الاحتفاظ بصلاحية الإدارة (Role: Admin) ولن يتم حذف حسابك من نظام المصادقة. فقط البيانات المخزنة في قاعدة البيانات سيتم تصفيرها.
        </p>
      </div>
    </div>
  );
}
