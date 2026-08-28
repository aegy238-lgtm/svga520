import React, { useState } from 'react';
import { AlertTriangle, RefreshCw, Download, ShieldAlert, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { getActiveClientVersion, setSimulatedClientVersion, CURRENT_APP_VERSION } from '../../utils/versionControl';

interface VersionBlockedModalProps {
  requiredVersion: string;
  installedVersion: string;
  userEmail?: string;
  userId?: string;
  onRetry?: () => void;
  updateUrl?: string;
}

export const VersionBlockedModal: React.FC<VersionBlockedModalProps> = ({
  requiredVersion,
  installedVersion,
  userEmail,
  userId,
  onRetry,
  updateUrl
}) => {
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateSuccess, setUpdateSuccess] = useState(false);

  const handleUpdateClick = () => {
    setIsUpdating(true);
    // Clear any simulated old version
    setSimulatedClientVersion(null);

    // 1. Clear Cache Storages completely to purge cached index.html / assets
    if ('caches' in window) {
      caches.keys().then((keys) => {
        keys.forEach((key) => caches.delete(key));
      }).catch(err => console.warn("Cache storage clear error:", err));
    }

    // 2. Unregister any service workers to prevent old workers from serving old cached site
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => registration.unregister());
      }).catch(err => console.warn("Service worker unregistration error:", err));
    }

    if (updateUrl && updateUrl.trim()) {
      window.location.href = updateUrl.trim();
      return;
    }

    setTimeout(() => {
      setIsUpdating(false);
      setUpdateSuccess(true);
      setTimeout(() => {
        // Cache bust reload using current timestamp to force getting the freshest version from server/CDN
        const cacheBusterUrl = window.location.origin + window.location.pathname + '?v=' + Date.now() + window.location.hash;
        window.location.href = cacheBusterUrl;
      }, 1000);
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-[999999] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 dir-rtl text-right">
      <div className="bg-slate-900 border border-red-500/30 rounded-2xl p-6 sm:p-8 max-w-lg w-full shadow-2xl relative overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Glow Effect */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-red-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Icon Header */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center mb-4 text-red-400 shadow-lg shadow-red-500/10">
            <ShieldAlert className="w-8 h-8 animate-pulse" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">
            إصدار الموقع غير مدعوم لحسابك
          </h2>
          <p className="text-slate-300 text-sm leading-relaxed max-w-md">
            هذا الإصدار من الموقع لم يعد مدعومًا لهذا الحساب. يرجى تحديث التطبيق إلى الإصدار <span className="text-amber-400 font-bold dir-ltr inline-block">{requiredVersion}</span> للاستمرار.
          </p>
        </div>

        {/* Details Card */}
        <div className="bg-slate-950/70 rounded-xl p-4 border border-slate-800/80 mb-6 space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-400 pb-2 border-b border-slate-800">
            <span>الحساب (User ID):</span>
            <span className="font-mono text-slate-200 dir-ltr text-left text-[11px] truncate max-w-[180px]">{userId || userEmail || 'غير معروف'}</span>
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">الإصدار الذي تستخدمه حالياً:</span>
            <span className="font-mono text-red-400 font-bold bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20 dir-ltr">
              {installedVersion}
            </span>
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">الإصدار المسموح المطلوب للحساب:</span>
            <span className="font-mono text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 dir-ltr">
              {requiredVersion}
            </span>
          </div>
        </div>

        {/* Action Button */}
        <div className="space-y-3">
          <button
            onClick={handleUpdateClick}
            disabled={isUpdating || updateSuccess}
            className="w-full py-3.5 px-5 bg-gradient-to-r from-amber-500 via-amber-600 to-amber-500 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold rounded-xl shadow-lg shadow-amber-500/20 transition-all duration-200 flex items-center justify-center gap-2 text-sm disabled:opacity-50"
          >
            {isUpdating ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                جاري التحديث والمزامنة...
              </>
            ) : updateSuccess ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-900" />
                تم التحديث بنجاح! جاري التوجيه...
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                تحديث إلى الإصدار المطلوب ({requiredVersion})
              </>
            )}
          </button>

          {onRetry && (
            <button
              onClick={onRetry}
              className="w-full py-2.5 px-4 bg-slate-800/80 hover:bg-slate-800 text-slate-300 rounded-xl text-xs font-medium transition-colors flex items-center justify-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              إعادة التحقق من السيرفر
            </button>
          )}
        </div>

        <p className="text-center text-[11px] text-slate-500 mt-5">
          ملاحظة: يتم التحقق والربط الآمن برمز الحساب بالسيرفر لمنع استخدام أي نسخة غير مسموحة.
        </p>
      </div>
    </div>
  );
};
