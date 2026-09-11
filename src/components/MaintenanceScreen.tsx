import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
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

  const titleAr = settings?.maintenanceTitle || 'حالياً سيرفر التطبيق متعطل الآن';
  const messageAr = settings?.maintenanceMessage || 'نعتذر لجميع المستخدمين عن هذا التوقف المؤقت. خوادم التطبيق تخضع حالياً لأعمال صيانة طارئة وفحص فني شامل لضمان أعلى مستويات الأداء والاستقرار. فريق الدعم الفني يعمل بكامل طاقته على استعادة كامل الخدمات في أقرب وقت ممكن. شكراً لتفهمكم وصبركم.';
  const titleEn = settings?.maintenanceTitleEn || 'Currently, the application server is down now.';
  const messageEn = settings?.maintenanceMessageEn || 'We sincerely apologize to all users for this temporary interruption. Our application servers are currently undergoing emergency maintenance and comprehensive technical inspections to ensure optimal performance and stability. Our technical team is actively working to restore all services as quickly as possible. Thank you for your understanding and patience.';
  const estimatedTime = settings?.maintenanceEstimatedTime;
  const appName = settings?.appName || 'SVGA Studio';
  const logoUrl = settings?.logoUrl;
  const whatsappNumber = settings?.whatsappNumber;

  return (
    <div className="min-h-screen w-full bg-[#030712] text-slate-100 flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-hidden font-sans" dir="rtl">
      {/* Background Animated Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-rose-600/15 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-[350px] h-[350px] bg-amber-600/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-10 left-10 w-[300px] h-[300px] bg-indigo-600/10 rounded-full blur-[100px] pointer-events-none" />

      {/* Grid Pattern Overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f29370a_1px,transparent_1px),linear-gradient(to_bottom,#1f29370a_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none" />

      {/* Top Bar Header with Logo and Brand */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-3xl flex items-center justify-between mb-8 z-10"
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
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-rose-600 via-amber-600 to-indigo-600 flex items-center justify-center font-bold text-white shadow-lg">
              {appName.charAt(0)}
            </div>
          )}
          <div>
            <h1 className="font-extrabold text-lg text-white tracking-tight">{appName}</h1>
            <p className="text-[11px] text-slate-400">Server Status Notification</p>
          </div>
        </div>

        {/* Live Status Badge */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-semibold shadow-[0_0_15px_rgba(244,63,94,0.15)]">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
          </span>
          <span>تعطل السيرفر مؤقتاً | Server Offline</span>
        </div>
      </motion.div>

      {/* Main Container Card */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-full max-w-3xl bg-slate-900/80 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 sm:p-10 shadow-2xl relative z-10 flex flex-col items-center text-center overflow-hidden"
      >
        {/* Animated Accent Line */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-rose-500 via-amber-500 to-indigo-500" />

        {/* Floating Server Outage Graphic */}
        <div className="relative mb-6">
          <motion.div 
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-gradient-to-br from-rose-500/20 via-amber-500/20 to-indigo-600/20 border border-white/15 flex items-center justify-center shadow-inner"
          >
            <ShieldAlert className="w-12 h-12 sm:w-14 sm:h-14 text-rose-400 drop-shadow-[0_0_15px_rgba(244,63,94,0.6)]" />
          </motion.div>

          <motion.div 
            animate={{ scale: [1, 1.2, 1], rotate: [0, 10, -10, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            className="absolute -top-2 -right-2 w-9 h-9 rounded-xl bg-amber-600 border border-white/20 flex items-center justify-center shadow-lg"
          >
            <Wrench className="w-5 h-5 text-white" />
          </motion.div>

          <div className="absolute -bottom-2 -left-2 w-9 h-9 rounded-xl bg-rose-600 border border-white/20 flex items-center justify-center shadow-lg">
            <Radio className="w-5 h-5 text-white animate-pulse" />
          </div>
        </div>

        {/* Status Indicator Tag */}
        <div className="inline-flex items-center gap-2 px-4 py-1 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-mono font-bold mb-4">
          <span>HTTP 503 SERVICE TEMPORARILY UNAVAILABLE</span>
        </div>

        {/* ================= Arabic Section ================= */}
        <div className="w-full mb-6 pb-6 border-b border-white/10" dir="rtl">
          <h2 className="text-2xl sm:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-rose-100 to-rose-300 mb-3 tracking-tight">
            {titleAr}
          </h2>
          <p className="text-slate-300 text-sm sm:text-base leading-relaxed max-w-xl mx-auto">
            {messageAr}
          </p>
        </div>

        {/* ================= English Section ================= */}
        <div className="w-full mb-6 pb-6 border-b border-white/10" dir="ltr">
          <div className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-rose-400/90 font-bold mb-2">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Official Outage Notice</span>
          </div>
          <h3 className="text-xl sm:text-2xl font-black text-white mb-2 tracking-tight">
            {titleEn}
          </h3>
          <p className="text-slate-300 text-xs sm:text-sm leading-relaxed max-w-xl mx-auto">
            {messageEn}
          </p>
        </div>

        {/* Estimated Time Badge (if configured) */}
        {estimatedTime && (
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-indigo-950/60 border border-indigo-500/30 text-indigo-200 text-xs sm:text-sm font-medium mb-6 shadow-sm">
            <Clock className="w-4 h-4 text-indigo-400 flex-shrink-0" />
            <span>الوقت المقدر لعودة الخدمة / Estimated Time: <strong className="text-white font-bold">{estimatedTime}</strong></span>
          </div>
        )}

        {/* Interactive Progress / Health Pulse */}
        <div className="w-full max-w-lg bg-slate-950/60 rounded-2xl p-4 border border-white/5 mb-8">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2 font-medium">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span>
              فحص السيرفر والاتصال بالخادم
            </span>
            <span className="text-amber-400 font-bold font-mono">Server Sync: Standby</span>
          </div>
          <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden relative">
            <motion.div 
              animate={{ x: ['-100%', '100%'] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              className="w-1/2 h-full bg-gradient-to-r from-transparent via-rose-500 to-transparent"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-3 w-full max-w-md">
          {/* Refresh Button */}
          <button
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="flex-1 min-w-[160px] px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 transition-all text-xs sm:text-sm font-bold text-white border border-white/10 flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-rose-400' : ''}`} />
            <span>{isRefreshing ? 'جاري الفحص...' : 'فحص حالة السيرفر / Check Server'}</span>
          </button>

          {/* WhatsApp Support Button */}
          {whatsappNumber && (
            <a
              href={`https://wa.me/${whatsappNumber.replace(/[^0-9]/g, '')}?text=${encodeURIComponent('مرحباً، أستفسر عن حالة تعطل سيرفر التطبيق وموعد عودة الخدمة.')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 min-w-[160px] px-5 py-3 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 active:scale-95 transition-all text-xs sm:text-sm font-bold flex items-center justify-center gap-2"
            >
              <MessageSquare className="w-4 h-4" />
              <span>الدعم الفني / Support</span>
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
          className="inline-flex items-center gap-2 text-xs text-slate-500 hover:text-rose-400 transition-colors px-3 py-1.5 rounded-lg hover:bg-white/5"
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
