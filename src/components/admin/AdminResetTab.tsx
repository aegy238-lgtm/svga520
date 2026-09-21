import React, { useState } from 'react';
import { db, auth } from '../../firebase';
import { doc, updateDoc, setDoc, deleteDoc, collection, getDocs, query, where, writeBatch } from 'firebase/firestore';
import { RefreshCw, AlertTriangle, ShieldAlert, ShoppingBag, BarChart3, Trash2, CheckCircle, Database } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { resetTelegramStats } from '../../services/telegramForwardService';

export default function AdminResetTab() {
  const { user } = useAuth();
  const [isResetting, setIsResetting] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  // Stats deletion states
  const [isDeletingPurchases, setIsDeletingPurchases] = useState(false);
  const [isDeletingGeneralStats, setIsDeletingGeneralStats] = useState(false);
  const [isDeletingAllStats, setIsDeletingAllStats] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  /**
   * Delete purchase and transaction statistics (احصائيات الشراء والطلبات)
   */
  const handleDeletePurchaseStats = async () => {
    if (!window.confirm('هل أنت متأكد من رغبتك في حذف جميع إحصائيات وسجلات الشراء والطلبات والمعاملات المالية؟ لا يمكن التراجع عن هذا الإجراء.')) {
      return;
    }

    setIsDeletingPurchases(true);
    setStatusMessage(null);

    try {
      let totalDeleted = 0;

      // 1. Delete all documents in 'orders' collection
      const ordersSnapshot = await getDocs(collection(db, 'orders'));
      const orderDeletions = ordersSnapshot.docs.map(d => deleteDoc(doc(db, 'orders', d.id)));
      await Promise.all(orderDeletions);
      totalDeleted += ordersSnapshot.size;

      // 2. Delete all documents in 'transactions' collection
      try {
        const transSnapshot = await getDocs(collection(db, 'transactions'));
        const transDeletions = transSnapshot.docs.map(d => deleteDoc(doc(db, 'transactions', d.id)));
        await Promise.all(transDeletions);
        totalDeleted += transSnapshot.size;
      } catch (_) {}

      // 3. Delete all documents in 'purchases' collection
      try {
        const purchasesSnapshot = await getDocs(collection(db, 'purchases'));
        const purchaseDeletions = purchasesSnapshot.docs.map(d => deleteDoc(doc(db, 'purchases', d.id)));
        await Promise.all(purchaseDeletions);
        totalDeleted += purchasesSnapshot.size;
      } catch (_) {}

      // 4. Reset spent totals in users collection
      try {
        const usersSnapshot = await getDocs(collection(db, 'users'));
        const userUpdates = usersSnapshot.docs.map(d => 
          updateDoc(doc(db, 'users', d.id), {
            totalSpent: 0,
            rechargeLevel: 1,
            usedPromoCodes: []
          }).catch(() => {})
        );
        await Promise.all(userUpdates);
      } catch (_) {}

      // 5. Delete global promo codes records
      try {
        const promoSnapshot = await getDocs(collection(db, 'globalUsedPromos'));
        const promoDeletions = promoSnapshot.docs.map(d => deleteDoc(doc(db, 'globalUsedPromos', d.id)));
        await Promise.all(promoDeletions);
      } catch (_) {}

      setStatusMessage({
        type: 'success',
        text: `تم حذف جميع إحصائيات الشراء والطلبات وتصفير مبالغ الإنفاق بنجاح (تم مسح ${totalDeleted} سجل).`
      });
    } catch (error: any) {
      console.error('Error deleting purchase statistics:', error);
      setStatusMessage({
        type: 'error',
        text: `حدث خطأ أثناء حذف إحصائيات الشراء: ${error.message}`
      });
    } finally {
      setIsDeletingPurchases(false);
    }
  };

  /**
   * Delete general site and analytics statistics (الاحصائيات العامه عن الموقع)
   */
  const handleDeleteGeneralStats = async () => {
    if (!window.confirm('هل أنت متأكد من حذف وتصفير جميع الإحصائيات العامة للموقع وسجلات النشاط والزيارات؟')) {
      return;
    }

    setIsDeletingGeneralStats(true);
    setStatusMessage(null);

    try {
      let totalDeleted = 0;

      // 1. Delete analytics collection
      try {
        const analyticsSnap = await getDocs(collection(db, 'analytics'));
        const analyticsDeletions = analyticsSnap.docs.map(d => deleteDoc(doc(db, 'analytics', d.id)));
        await Promise.all(analyticsDeletions);
        totalDeleted += analyticsSnap.size;
      } catch (_) {}

      // 2. Delete visitorStats collection
      try {
        const visitorSnap = await getDocs(collection(db, 'visitorStats'));
        const visitorDeletions = visitorSnap.docs.map(d => deleteDoc(doc(db, 'visitorStats', d.id)));
        await Promise.all(visitorDeletions);
        totalDeleted += visitorSnap.size;
      } catch (_) {}

      // 3. Delete siteStats collection
      try {
        const siteStatsSnap = await getDocs(collection(db, 'siteStats'));
        const siteStatsDeletions = siteStatsSnap.docs.map(d => deleteDoc(doc(db, 'siteStats', d.id)));
        await Promise.all(siteStatsDeletions);
        totalDeleted += siteStatsSnap.size;
      } catch (_) {}

      // 4. Delete user activity logs
      try {
        const activitySnap = await getDocs(collection(db, 'user_activity_logs'));
        const activityDeletions = activitySnap.docs.map(d => deleteDoc(doc(db, 'user_activity_logs', d.id)));
        await Promise.all(activityDeletions);
        totalDeleted += activitySnap.size;
      } catch (_) {}

      // 5. Delete cache activities
      try {
        const cacheActSnap = await getDocs(collection(db, 'cache_activities'));
        const cacheActDeletions = cacheActSnap.docs.map(d => deleteDoc(doc(db, 'cache_activities', d.id)));
        await Promise.all(cacheActDeletions);
        totalDeleted += cacheActSnap.size;
      } catch (_) {}

      // 6. Reset Telegram forwarded counters
      await resetTelegramStats().catch(() => {});

      setStatusMessage({
        type: 'success',
        text: `تم حذف وتصفير جميع الإحصائيات العامة للموقع وسجلات النشاط والزيارات بنجاح (تم مسح ${totalDeleted} سجل).`
      });
    } catch (error: any) {
      console.error('Error deleting general site statistics:', error);
      setStatusMessage({
        type: 'error',
        text: `حدث خطأ أثناء حذف الإحصائيات العامة: ${error.message}`
      });
    } finally {
      setIsDeletingGeneralStats(false);
    }
  };

  /**
   * Delete ALL statistics (Purchases + General Site Stats) with one click
   */
  const handleDeleteAllStats = async () => {
    if (!window.confirm('⚠️ تحذير: سيتم حذف جميع إحصائيات الموقع بالكامل (إحصائيات الشراء + الإحصائيات العامة والنشاط) دفعة واحدة. هل تريد الاستمرار؟')) {
      return;
    }

    setIsDeletingAllStats(true);
    try {
      await handleDeletePurchaseStats();
      await handleDeleteGeneralStats();
      setStatusMessage({
        type: 'success',
        text: 'تم تصفير وحذف جميع الإحصائيات بالكامل (الشراء + الإحصائيات العامة للموقع) بنجاح.'
      });
    } finally {
      setIsDeletingAllStats(false);
    }
  };

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
      
      alert('تم إعادة تعيين الحساب بنجاح! سيتم تحديث البيانات تلقائياً.');
      setConfirmText('');
    } catch (error: any) {
      alert('خطأ في إعادة التعيين: ' + error.message);
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Success / Error Notification */}
      {statusMessage && (
        <div className={`p-4 rounded-2xl flex items-center gap-3 border shadow-sm ${
          statusMessage.type === 'success'
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
            : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          {statusMessage.type === 'success' ? (
            <CheckCircle className="w-6 h-6 text-emerald-600 shrink-0" />
          ) : (
            <AlertTriangle className="w-6 h-6 text-red-600 shrink-0" />
          )}
          <span className="text-sm font-semibold">{statusMessage.text}</span>
        </div>
      )}

      {/* 📊 Section 1: حذف إحصائيات الشراء والإحصائيات العامة */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-6">
        <div className="flex items-center gap-3 text-slate-800 border-b border-slate-100 pb-4">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">إدارة وتصفير إحصائيات الموقع والشراء</h2>
            <p className="text-xs text-slate-500">تحكم فوري في حذف بيانات المبيعات، الطلبات، وسجلات الإحصائيات العامة</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Card 1: حذف إحصائيات الشراء */}
          <div className="bg-amber-50/60 border border-amber-200/80 rounded-2xl p-5 flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
                <ShoppingBag className="w-5 h-5 text-amber-600" />
                <span>حذف إحصائيات الشراء والطلبات</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                يقوم بمسح جميع سجلات الطلبات (Orders)، المعاملات المالية (Transactions)، المشتريات (Purchases)، وتصفير إجمالي مبالغ الإنفاق للمستخدمين.
              </p>
            </div>

            <button
              onClick={handleDeletePurchaseStats}
              disabled={isDeletingPurchases || isDeletingAllStats}
              className="w-full bg-amber-600 hover:bg-amber-700 text-white py-3 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-md shadow-amber-600/20 disabled:opacity-50 cursor-pointer"
            >
              {isDeletingPurchases ? (
                <RefreshCw className="animate-spin w-4 h-4" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
              <span>{isDeletingPurchases ? 'جاري مسح إحصائيات الشراء...' : 'حذف إحصائيات الشراء الآن'}</span>
            </button>
          </div>

          {/* Card 2: حذف الإحصائيات العامة */}
          <div className="bg-sky-50/60 border border-sky-200/80 rounded-2xl p-5 flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sky-900 font-bold text-sm">
                <BarChart3 className="w-5 h-5 text-sky-600" />
                <span>حذف الإحصائيات العامة للموقع</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                يقوم بمسح إحصائيات الزيارات (Analytics)، سجلات النشاط (Activity Logs)، سجلات الكاش، وإحصائيات التيليجرام العامة للبدء من جديد.
              </p>
            </div>

            <button
              onClick={handleDeleteGeneralStats}
              disabled={isDeletingGeneralStats || isDeletingAllStats}
              className="w-full bg-sky-600 hover:bg-sky-700 text-white py-3 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-md shadow-sky-600/20 disabled:opacity-50 cursor-pointer"
            >
              {isDeletingGeneralStats ? (
                <RefreshCw className="animate-spin w-4 h-4" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
              <span>{isDeletingGeneralStats ? 'جاري مسح الإحصائيات العامة...' : 'حذف الإحصائيات العامة الآن'}</span>
            </button>
          </div>
        </div>

        {/* زر الحذف الشامل لكل الإحصائيات */}
        <div className="border-t border-slate-100 pt-4 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50 p-4 rounded-2xl">
          <div className="text-xs text-slate-600">
            <span className="font-bold text-slate-800">حذف شامل وسريع: </span>
            تصفير جميع الإحصائيات معاً (إحصائيات الشراء + الإحصائيات العامة) بنقرة واحدة.
          </div>
          <button
            onClick={handleDeleteAllStats}
            disabled={isDeletingAllStats || isDeletingPurchases || isDeletingGeneralStats}
            className="shrink-0 bg-slate-900 hover:bg-slate-800 text-white py-2.5 px-5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-md disabled:opacity-50 cursor-pointer"
          >
            {isDeletingAllStats ? (
              <RefreshCw className="animate-spin w-4 h-4" />
            ) : (
              <Trash2 className="w-4 h-4 text-rose-400" />
            )}
            <span>{isDeletingAllStats ? 'جاري الحذف الشامل...' : 'حذف جميع الإحصائيات معاً'}</span>
          </button>
        </div>
      </div>

      {/* 🛡️ Section 2: إعادة تعيين حساب المدير */}
      <div className="bg-red-50 border border-red-100 p-6 rounded-3xl shadow-sm">
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
              className="w-full p-3 border border-red-200 rounded-xl focus:ring-2 focus:ring-red-500 outline-none font-mono text-center uppercase bg-white"
              placeholder="RESET"
            />
          </div>

          <button
            onClick={handleReset}
            disabled={isResetting || confirmText !== 'RESET'}
            className="w-full bg-red-600 text-white py-4 rounded-xl font-bold hover:bg-red-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-red-500/20 cursor-pointer"
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

