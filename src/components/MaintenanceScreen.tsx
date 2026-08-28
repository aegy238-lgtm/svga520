import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Wrench, 
  Sparkles, 
  Clock, 
  RefreshCw, 
  ShieldAlert, 
  Lock, 
  LogIn, 
  MessageSquare, 
  X, 
  CheckCircle2, 
  AlertTriangle,
  Radio
} from 'lucide-react';
import { AppSettings, UserRecord } from '../types';
import { useAuth } from '../contexts/AuthContext';

interface MaintenanceScreenProps {
  settings: AppSettings | null;
  currentUser: UserRecord | null;
  onRefresh?: () => void;
}

export const MaintenanceScreen: React.FC<MaintenanceScreenProps> = ({ 
  settings, 
  currentUser,
  onRefresh 
}) => {
  const { login, logout } = useAuth();
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleManualRefresh = () => {
    setIsRefreshing(true);
    if (onRefresh) onRefresh();
    setTimeout(() => {
      setIsRefreshing(false);
    }, 1000);
  };

  const handleAdminLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setIsSubmitting(true);
    try {
      await login(adminEmail, adminPassword);
      setShowAdminLogin(false);
    } catch (err: any) {
      console.error("Admin login error during maintenance:", err);
      setLoginError(err.message || 'فشل تسجيل الدخول. يرجى التحقق من بيانات الدخول.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const title = settings?.maintenanceTitle || 'الموقع تحت التحديث والتطوير';
  const message = settings?.maintenanceMessage || 'الموقع حالياً تحت التحديث والتطوير، يرجى الانتظار حتى انتهاء أعمال التطوير.';
  const estimatedTime = settings?.maintenanceEstimatedTime;
  const appName = settings?.appName || 'SVGA Studio';
  const logoUrl = settings?.logoUrl;
  const whatsappNumber = settings?.whatsappNumber;

  return (
    <div className="min-h-screen w-full bg-[#030712] text-slate-100 flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-hidden font-sans" dir="rtl">
      {/* Background Animated Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-purple-600/15 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-[350px] h-[350px] bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-10 left-10 w-[300px] h-[300px] bg-amber-500/10 rounded-full blur-[100px] pointer-events-none" />

      {/* Grid Pattern Overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f29370a_1px,transparent_1px),linear-gradient(to_bottom,#1f29370a_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none" />

      {/* Top Bar Header with Logo and Brand */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-2xl flex items-center justify-between mb-8 z-10"
      >
        <div className="flex items-center gap-3">
          {logoUrl ? (
            <img 
              src={logoUrl} 
              alt={appName} 
              className="w-10 h-10 object-contain rounded-xl shadow-lg border border-white/10" 
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center font-bold text-white shadow-lg">
              {appName.charAt(0)}
            </div>
          )}
          <div>
            <h1 className="font-extrabold text-lg text-white tracking-tight">{appName}</h1>
            <p className="text-[11px] text-slate-400">المنصة الرسمية</p>
          </div>
        </div>

        {/* Live Status Badge */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold shadow-[0_0_15px_rgba(245,158,11,0.15)]">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
          </span>
          <span>وضع التحديث والتطوير</span>
        </div>
      </motion.div>

      {/* Main Container Card */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-full max-w-2xl bg-slate-900/80 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 sm:p-10 shadow-2xl relative z-10 flex flex-col items-center text-center overflow-hidden"
      >
        {/* Animated Accent Line */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-purple-500 to-indigo-500" />

        {/* Floating Icons & Gears Graphic */}
        <div className="relative mb-6">
          <motion.div 
            animate={{ rotate: 360 }}
            transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
            className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-gradient-to-br from-amber-500/20 via-purple-600/20 to-indigo-600/20 border border-white/15 flex items-center justify-center shadow-inner"
          >
            <Wrench className="w-12 h-12 sm:w-14 sm:h-14 text-amber-400 drop-shadow-[0_0_12px_rgba(245,158,11,0.5)]" />
          </motion.div>

          <motion.div 
            animate={{ scale: [1, 1.2, 1], rotate: [0, 10, -10, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            className="absolute -top-2 -right-2 w-9 h-9 rounded-xl bg-purple-600 border border-white/20 flex items-center justify-center shadow-lg"
          >
            <Sparkles className="w-5 h-5 text-white" />
          </motion.div>

          <div className="absolute -bottom-2 -left-2 w-9 h-9 rounded-xl bg-indigo-600 border border-white/20 flex items-center justify-center shadow-lg">
            <Radio className="w-5 h-5 text-white animate-pulse" />
          </div>
        </div>

        {/* Title */}
        <h2 className="text-2xl sm:text-3xl font-black text-white mb-3 tracking-tight">
          {title}
        </h2>

        {/* Subtitle / Notification Text */}
        <p className="text-slate-300 text-sm sm:text-base leading-relaxed max-w-lg mb-6">
          {message}
        </p>

        {/* Estimated Time Badge (if configured) */}
        {estimatedTime && (
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-indigo-950/60 border border-indigo-500/30 text-indigo-200 text-xs sm:text-sm font-medium mb-6 shadow-sm">
            <Clock className="w-4 h-4 text-indigo-400 flex-shrink-0" />
            <span>الوقت المقدر للانتهاء: <strong className="text-white font-bold">{estimatedTime}</strong></span>
          </div>
        )}

        {/* Interactive Progress / Loading Animation */}
        <div className="w-full max-w-md bg-slate-950/60 rounded-2xl p-4 border border-white/5 mb-8">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2 font-medium">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
              تحديث البنية التحتية والميزات
            </span>
            <span className="text-purple-400 font-bold">جاري العمل...</span>
          </div>
          <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden relative">
            <motion.div 
              animate={{ x: ['-100%', '100%'] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              className="w-1/2 h-full bg-gradient-to-r from-transparent via-purple-500 to-transparent"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-3 w-full max-w-md">
          {/* Refresh Button */}
          <button
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="flex-1 min-w-[140px] px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 transition-all text-xs sm:text-sm font-bold text-white border border-white/10 flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-purple-400' : ''}`} />
            <span>{isRefreshing ? 'جاري الفحص...' : 'فحص حالة الموقع'}</span>
          </button>

          {/* WhatsApp Support Button */}
          {whatsappNumber && (
            <a
              href={`https://wa.me/${whatsappNumber.replace(/[^0-9]/g, '')}?text=${encodeURIComponent('مرحباً، أستفسر عن موعد انتهاء تحديث وتطوير الموقع.')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 min-w-[140px] px-4 py-3 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 active:scale-95 transition-all text-xs sm:text-sm font-bold flex items-center justify-center gap-2"
            >
              <MessageSquare className="w-4 h-4" />
              <span>الدعم الفني</span>
            </a>
          )}
        </div>

        {/* Logged-in Info Notice */}
        {currentUser && (
          <div className="mt-6 pt-4 border-t border-white/5 w-full flex items-center justify-between text-[11px] text-slate-500">
            <span className="truncate">حسابك الحالي: <span className="text-slate-300 font-medium">{currentUser.name || currentUser.email}</span></span>
            <button 
              onClick={logout}
              className="text-red-400 hover:text-red-300 underline font-medium mr-2 flex-shrink-0"
            >
              تسجيل الخروج
            </button>
          </div>
        )}
      </motion.div>

      {/* Admin Login Bypass Trigger at Bottom */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="mt-8 text-center z-10"
      >
        <button
          onClick={() => setShowAdminLogin(true)}
          className="inline-flex items-center gap-2 text-xs text-slate-500 hover:text-purple-400 transition-colors px-3 py-1.5 rounded-lg hover:bg-white/5"
        >
          <Lock className="w-3.5 h-3.5" />
          <span>دخول إدارة النظام (Admin Login)</span>
        </button>
      </motion.div>

      {/* Admin Login Modal */}
      <AnimatePresence>
        {showAdminLogin && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900 border border-purple-500/30 rounded-3xl p-6 sm:p-8 w-full max-w-md shadow-2xl relative"
            >
              <button
                onClick={() => setShowAdminLogin(false)}
                className="absolute top-4 left-4 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-purple-600/20 border border-purple-500/40 flex items-center justify-center text-purple-400">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-white">تسجيل دخول الإدارة</h3>
                  <p className="text-xs text-slate-400">للمسؤولين ومدير النظام فقط</p>
                </div>
              </div>

              {loginError && (
                <div className="p-3 mb-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>{loginError}</span>
                </div>
              )}

              <form onSubmit={handleAdminLoginSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">البريد الإلكتروني للإدارة</label>
                  <input
                    type="email"
                    required
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    placeholder="admin@example.com"
                    dir="ltr"
                    className="w-full bg-slate-950/80 border border-white/10 focus:border-purple-500 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">كلمة المرور</label>
                  <input
                    type="password"
                    required
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="••••••••"
                    dir="ltr"
                    className="w-full bg-slate-950/80 border border-white/10 focus:border-purple-500 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none transition-all"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-sm transition-all shadow-lg shadow-purple-600/30 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
                >
                  {isSubmitting ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <LogIn className="w-4 h-4" />
                      <span>دخول كمدير</span>
                    </>
                  )}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
