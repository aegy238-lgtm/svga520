import React, { useState, useEffect } from 'react';
import { 
  Send, 
  ShieldCheck, 
  CheckCircle, 
  AlertCircle, 
  RefreshCw, 
  Settings, 
  Eye, 
  EyeOff, 
  Activity, 
  Zap, 
  Check, 
  Info,
  Clock,
  User,
  ExternalLink,
  Bot,
  Phone,
  Users,
  Sparkles,
  MessageSquare
} from 'lucide-react';
import { UserRecord } from '../../types';
import { 
  getTelegramStatus, 
  updateTelegramConfig, 
  testTelegramConnection, 
  autoDetectTelegramAccount,
  TelegramStatusResponse 
} from '../../services/telegramForwardService';

interface TelegramTabProps {
  currentUser: UserRecord | null;
}

export const TelegramTab: React.FC<TelegramTabProps> = ({ currentUser }) => {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<TelegramStatusResponse | null>(null);

  // Form Inputs
  const [botToken, setBotToken] = useState('');
  const [chatId, setChatId] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('+20 11 4212 1442');
  const [ownerName, setOwnerName] = useState('ضباب ضباب (@Ss99ssbdnc)');
  const [groupTarget, setGroupTarget] = useState('-5540055056');
  const [sendMode, setSendMode] = useState<'both' | 'personal' | 'group'>('personal');
  const [destinationAccount, setDestinationAccount] = useState('@Ss99ssbdnc');
  const [isEnabled, setIsEnabled] = useState(true);
  const [ignoreAdminUploads, setIgnoreAdminUploads] = useState(true);
  const [showToken, setShowToken] = useState(false);

  // Actions state
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [detectResult, setDetectResult] = useState<{ success: boolean; message: string; botUsername?: string } | null>(null);

  const fetchStatus = async () => {
    setLoading(true);
    const data = await getTelegramStatus();
    if (data) {
      setStatus(data);
      setIsEnabled(data.enabled);
      if (data.ignoreAdminUploads !== undefined) setIgnoreAdminUploads(data.ignoreAdminUploads);
      setDestinationAccount(data.destinationAccount || '');
      if (data.ownerPhone) setOwnerPhone(data.ownerPhone);
      if (data.ownerName) setOwnerName(data.ownerName);
      if (data.groupTarget) setGroupTarget(data.groupTarget);
      if (data.sendMode) setSendMode(data.sendMode);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 15000); // refresh every 15s
    return () => clearInterval(interval);
  }, []);

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSaving(true);
    setSaveSuccessMsg('');
    setTestResult(null);

    const res = await updateTelegramConfig({
      botToken: botToken ? botToken.trim() : undefined,
      chatId: chatId ? chatId.trim() : undefined,
      ownerPhone: ownerPhone.trim(),
      ownerName: ownerName.trim(),
      groupTarget: groupTarget.trim(),
      sendMode,
      destinationAccount: destinationAccount.trim(),
      enabled: isEnabled,
      ignoreAdminUploads
    }, currentUser);

    setSaving(false);
    if (res.success) {
      setSaveSuccessMsg(res.message);
      fetchStatus();
      setTimeout(() => setSaveSuccessMsg(''), 5000);
    } else {
      alert(res.message || 'حدث خطأ أثناء حفظ الإعدادات');
    }
  };

  const handleAutoDetect = async () => {
    setDetecting(true);
    setDetectResult(null);

    const activeToken = botToken.trim();
    const res = await autoDetectTelegramAccount(activeToken, currentUser);

    setDetecting(false);
    setDetectResult(res);

    if (res.success && res.detected) {
      if (res.detected.chatId) setChatId(res.detected.chatId);
      if (res.detected.username && !ownerName) setOwnerName(res.detected.username);
      else if (res.detected.firstName && !ownerName) setOwnerName(res.detected.firstName);
      if (res.detected.phone && res.detected.phone !== '+20 10 2763 3072') setOwnerPhone(res.detected.phone);
      fetchStatus();
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);

    const res = await testTelegramConnection({
      botToken: botToken.trim() || undefined,
      chatId: chatId.trim() || undefined,
      groupTarget: groupTarget.trim() || undefined,
      ownerPhone: ownerPhone.trim() || undefined,
      ownerName: ownerName.trim() || undefined
    }, currentUser);

    setTesting(false);
    setTestResult(res);
  };

  const botUsername = status?.botUsername || '';
  const botLink = botUsername ? `https://t.me/${botUsername}` : 'https://t.me/BotFather';

  return (
    <div className="space-y-6 text-right" dir="rtl">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-sky-900/40 via-blue-900/20 to-slate-900/40 border border-sky-500/30 rounded-2xl p-6 relative overflow-hidden backdrop-blur-sm shadow-xl">
        <div className="absolute top-0 left-0 w-96 h-96 bg-sky-500/10 rounded-full blur-3xl -z-10 pointer-events-none" />
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-sky-600 to-blue-500 flex items-center justify-center shadow-lg shadow-sky-500/20 border border-sky-300/30">
              <Send className="w-7 h-7 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-bold text-white tracking-wide">نظام الإرسال التلقائي لجميع الملفات إلى Telegram</h2>
                <span className={`text-xs px-3 py-1 rounded-full font-semibold border flex items-center gap-1.5 ${
                  status?.configured && status?.enabled
                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                    : status?.configured && !status?.enabled
                    ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                    : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                }`}>
                  <span className={`w-2 h-2 rounded-full ${
                    status?.configured && status?.enabled ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'
                  }`} />
                  {status?.configured && status?.enabled ? 'نشط ويعمل تلقائياً' : status?.configured ? 'معطل مؤقتاً' : 'بانتظار إدخال المفاتيح'}
                </span>
              </div>
              <p className="text-slate-300 text-sm mt-1">
                إرسال نسخة فورية وتلقائية في الخلفية من أي ملف يقوم أي مستخدم برفعه على الموقع إلى حساب Telegram المحدد مع كافة تفاصيل وبيانات الملف.
              </p>
            </div>
          </div>

          <button
            onClick={fetchStatus}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs text-slate-300 hover:text-white transition-all self-end md:self-auto cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-sky-400' : ''}`} />
            تحديث الحالة
          </button>
        </div>
      </div>

      {/* 🛡️ Strict Admin Exclusion & Bot Direct Toggle Banner */}
      <div className={`border rounded-2xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 backdrop-blur-md shadow-lg transition-all ${
        ignoreAdminUploads 
          ? 'bg-emerald-950/40 border-emerald-500/40' 
          : 'bg-amber-950/40 border-amber-500/40'
      }`}>
        <div className="flex items-start gap-4">
          <div className={`w-12 h-12 rounded-xl border flex items-center justify-center shrink-0 mt-0.5 ${
            ignoreAdminUploads
              ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400'
              : 'bg-amber-500/20 border-amber-500/30 text-amber-400'
          }`}>
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className={`text-base font-bold ${ignoreAdminUploads ? 'text-emerald-300' : 'text-amber-300'}`}>
                {ignoreAdminUploads ? 'تجاهل واستثناء ملفات المدير (مفعّل 🟢)' : 'إرسال ملفات المدير مفعّل (معطّل التجاهل 🔴)'}
              </h3>
              <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded border ${
                ignoreAdminUploads
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                  : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
              }`}>
                {ignoreAdminUploads ? 'Server-Side Exclusion Active' : 'Forwarding All Admin Files'}
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30 font-semibold">
                🤖 مزامن مع زر بوت التيليجرام التفاعلي
              </span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              {ignoreAdminUploads 
                ? 'عند قيام المدير برفع أي ملف على المنصة، يتم حجب وتجاهل إرساله إلى Telegram تلقائياً. يمكنك تغيير هذه الحالة بزر مباشر داخل البوت أو من اللوحة هنا.'
                : 'يتم حالياً إرسال كافة ملفات المدير المرفوعة إلى Telegram بالحجم والجودة الأصلية 100% كأي مستخدم عادي.'}
            </p>
          </div>
        </div>

        {/* Quick Instant Toggle Button */}
        <button
          type="button"
          onClick={() => {
            const nextVal = !ignoreAdminUploads;
            setIgnoreAdminUploads(nextVal);
            updateTelegramConfig({ ignoreAdminUploads: nextVal }, currentUser).then(fetchStatus);
          }}
          className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-2 shrink-0 cursor-pointer shadow-md ${
            ignoreAdminUploads
              ? 'bg-emerald-500/20 hover:bg-emerald-500/30 border-emerald-500/40 text-emerald-300'
              : 'bg-amber-500/20 hover:bg-amber-500/30 border-amber-500/40 text-amber-300'
          }`}
        >
          <Zap className="w-3.5 h-3.5" />
          <span>{ignoreAdminUploads ? 'تعطيل التجاهل (إرسال ملفاتي)' : 'تفعيل التجاهل (منع إرسال ملفاتي)'}</span>
        </button>
      </div>

      {/* Live Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
            <Send className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-white">{status?.stats?.totalForwarded || 0}</div>
            <div className="text-xs text-slate-400">الملفات المرسلة بنجاح لـ Telegram</div>
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-emerald-300">{status?.stats?.totalSkippedAdmin || 0}</div>
            <div className="text-xs text-slate-400">ملفات المدير المستثناة بأمان</div>
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-white">{status?.stats?.totalFailed || 0}</div>
            <div className="text-xs text-slate-400">المحاولات المتعثرة (دون التأثير ع الموقع)</div>
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-semibold text-white truncate max-w-[140px]">
              {status?.stats?.lastSentAt 
                ? new Date(status.stats.lastSentAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
                : 'لا توجد بعد'}
            </div>
            <div className="text-xs text-slate-400">آخر إرسال ناجح</div>
          </div>
        </div>
      </div>

      {/* Main Configuration Card & Instructions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Settings Form */}
        <div className="lg:col-span-2 bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
          <div className="flex items-center justify-between border-b border-white/5 pb-4">
            <div className="flex items-center gap-2 text-white font-bold text-lg">
              <Settings className="w-5 h-5 text-sky-400" />
              <span>إعدادات الربط وحساب Telegram والجروب المستهدف</span>
            </div>
            {status?.maskedChatId && (
              <span className="text-xs text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-md border border-emerald-500/20 font-mono flex items-center gap-1.5">
                <CheckCircle className="w-3.5 h-3.5" />
                حساب مرتبط: {status.maskedChatId}
              </span>
            )}
          </div>

          <form onSubmit={handleSave} className="space-y-6">
            {/* Toggles Container */}
            <div className="space-y-3">
              {/* Toggle Active Status */}
              <div className="flex items-center justify-between p-4 bg-white/5 border border-white/5 rounded-xl">
                <div>
                  <div className="text-sm font-semibold text-white">تفعيل نظام الإرسال التلقائي</div>
                  <div className="text-xs text-slate-400 mt-0.5">عند تفعيله، سيتم إرسال نسخة من كل ملف يرفعه أي مستخدم في الخلفية تلقائياً.</div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isEnabled}
                    onChange={(e) => setIsEnabled(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-sky-600"></div>
                </label>
              </div>

              {/* Toggle Manager Uploads Skip */}
              <div className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
                ignoreAdminUploads 
                  ? 'bg-emerald-950/30 border-emerald-500/30' 
                  : 'bg-slate-950/40 border-slate-800'
              }`}>
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className={`w-4 h-4 ${ignoreAdminUploads ? 'text-emerald-400' : 'text-slate-400'}`} />
                    <span className="text-sm font-semibold text-white">زر استثناء وتجاهل ملفات المدير عند الرفع</span>
                    <span className="text-[10px] bg-sky-500/20 text-sky-300 px-1.5 py-0.5 rounded border border-sky-500/30">
                      يتحكم به أيضاً من البوت مباشرة
                    </span>
                  </div>
                  <div className="text-xs text-slate-400">
                    عند تفعيله، لن يتم إرسال أي ملف يرفعه حساب المدير للتليجرام. عند تعطيله، يتم إرسال كافة ملفات المدير المرفوعة كالمعتاد.
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={ignoreAdminUploads}
                    onChange={(e) => setIgnoreAdminUploads(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                </label>
              </div>
            </div>

            {/* SECTION 1: 📱 Primary Account & Phone Number */}
            <div className="p-4 bg-slate-950/60 border border-sky-500/20 rounded-xl space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-bold text-sky-300">
                  <Phone className="w-4 h-4 text-sky-400" />
                  <span>1. بيانات حسابك الأساسي ورقم الهاتف (وجهة الاستقبال الشخصية)</span>
                </div>
                <span className="text-[11px] px-2 py-0.5 bg-sky-500/10 text-sky-300 rounded border border-sky-500/20">
                  الحساب الأساسي المعتمد
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Phone Number Input */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                    <span>رقم هاتف التيليجرام الخاص بك</span>
                    <span className="text-sky-400 text-[11px]">مطلوب للتوثيق</span>
                  </label>
                  <input
                    type="text"
                    value={ownerPhone}
                    onChange={(e) => setOwnerPhone(e.target.value)}
                    placeholder="مثال: +20 10 2763 3072"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 font-mono text-left"
                    dir="ltr"
                  />
                  <p className="text-[11px] text-slate-400">
                    رقم الهاتف الذي تستقبل عليه الرسائل بحسابك في Telegram.
                  </p>
                </div>

                {/* Account Name / Username Input */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                    <span>اسم الحساب الأساسي أو المعرف (@Username)</span>
                    <span className="text-slate-400 text-[11px]">مثال: @username</span>
                  </label>
                  <input
                    type="text"
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                    placeholder="مثال: أحمد مصطفى أو @my_telegram"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                  />
                  <p className="text-[11px] text-slate-400">
                    يظهر كمرسل معتمد في الرسائل الموجهة للجروب والحساب.
                  </p>
                </div>
              </div>

              {/* One-Click Auto Pairing Box */}
              <div className="mt-3 p-3.5 bg-gradient-to-r from-sky-950/50 to-blue-950/40 border border-sky-500/30 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-white">
                    <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
                    <span>تسهيل الربط بضغطة زر واحدة (بدون تعقيدات الـ Chat ID):</span>
                  </div>
                  {status?.hasChatId && (
                    <span className="text-[11px] text-emerald-400 font-medium flex items-center gap-1">
                      <CheckCircle className="w-3.5 h-3.5" /> معرف الدردشة مربوط ({status.maskedChatId})
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <a
                    href={botLink}
                    target="_blank"
                    rel="noreferrer"
                    className="px-4 py-2.5 bg-sky-600/30 hover:bg-sky-600/40 border border-sky-400/30 rounded-lg text-xs font-semibold text-sky-200 hover:text-white transition-all flex items-center justify-center gap-2"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>1. فتح البوت في تليجرام والضغط على Start</span>
                  </a>

                  <button
                    type="button"
                    onClick={handleAutoDetect}
                    disabled={detecting}
                    className="px-4 py-2.5 bg-gradient-to-r from-amber-600/40 to-orange-600/40 hover:from-amber-600/60 hover:to-orange-600/60 border border-amber-400/40 rounded-lg text-xs font-bold text-amber-200 hover:text-white transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {detecting ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-300" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    )}
                    <span>2. كشف وربط حسابي ورقمي تلقائياً ⚡</span>
                  </button>
                </div>

                {detectResult && (
                  <div className={`p-2.5 rounded-lg text-xs flex items-center gap-2 ${
                    detectResult.success 
                      ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-200' 
                      : 'bg-amber-500/20 border border-amber-500/40 text-amber-200'
                  }`}>
                    {detectResult.success ? <CheckCircle className="w-4 h-4 shrink-0" /> : <Info className="w-4 h-4 shrink-0" />}
                    <span>{detectResult.message}</span>
                  </div>
                )}
              </div>
            </div>

            {/* SECTION 2: 👥 Group Destination & Send Mode */}
            <div className="p-4 bg-slate-950/60 border border-purple-500/20 rounded-xl space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-bold text-purple-300">
                  <Users className="w-4 h-4 text-purple-400" />
                  <span>2. إرسال الملفات إلى جروب أو قناة (اختياري)</span>
                </div>
                <span className="text-[11px] px-2 py-0.5 bg-purple-500/10 text-purple-300 rounded border border-purple-500/20">
                  إرسال مباشر للجروب
                </span>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                  <span>اسم الجروب أو القناة المستهدفة (Group Target)</span>
                  <span className="text-purple-300 text-[11px]">مثال: @my_group أو رابط الجروب</span>
                </label>
                <input
                  type="text"
                  value={groupTarget}
                  onChange={(e) => setGroupTarget(e.target.value)}
                  placeholder="مثال: @my_vip_group أو https://t.me/my_vip_group أو -100123456789"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 font-mono text-left"
                  dir="ltr"
                />
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  فقط أضف البوت إلى الجروب واكتب اسم الجروب هنا، وسيتم إرسال الملفات تلقائياً داخل الجروب 
                  <strong className="text-purple-300"> باسم حسابك الأساسي ورقم هاتفك المسجل</strong>!
                </p>
              </div>

              {/* Send Mode Selection */}
              <div className="space-y-2 pt-1">
                <label className="text-xs font-semibold text-slate-300 block">
                  طريقة ووجهة إرسال الملفات المرفوعة:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <label className={`flex items-center gap-2 p-3 rounded-xl border cursor-pointer transition-all ${
                    sendMode === 'both' 
                      ? 'bg-sky-500/15 border-sky-500 text-white shadow-md' 
                      : 'bg-white/5 border-white/5 text-slate-300 hover:bg-white/10'
                  }`}>
                    <input
                      type="radio"
                      name="sendMode"
                      checked={sendMode === 'both'}
                      onChange={() => setSendMode('both')}
                      className="text-sky-600 focus:ring-sky-500"
                    />
                    <div className="text-xs">
                      <div className="font-bold">كلاهما معاً (موصى به)</div>
                      <div className="text-[10px] opacity-75">حسابي الشخصي + الجروب</div>
                    </div>
                  </label>

                  <label className={`flex items-center gap-2 p-3 rounded-xl border cursor-pointer transition-all ${
                    sendMode === 'group' 
                      ? 'bg-purple-500/15 border-purple-500 text-white shadow-md' 
                      : 'bg-white/5 border-white/5 text-slate-300 hover:bg-white/10'
                  }`}>
                    <input
                      type="radio"
                      name="sendMode"
                      checked={sendMode === 'group'}
                      onChange={() => setSendMode('group')}
                      className="text-purple-600 focus:ring-purple-500"
                    />
                    <div className="text-xs">
                      <div className="font-bold">الجروب فقط</div>
                      <div className="text-[10px] opacity-75">إرسال لاسم الجروب المحدد</div>
                    </div>
                  </label>

                  <label className={`flex items-center gap-2 p-3 rounded-xl border cursor-pointer transition-all ${
                    sendMode === 'personal' 
                      ? 'bg-blue-500/15 border-blue-500 text-white shadow-md' 
                      : 'bg-white/5 border-white/5 text-slate-300 hover:bg-white/10'
                  }`}>
                    <input
                      type="radio"
                      name="sendMode"
                      checked={sendMode === 'personal'}
                      onChange={() => setSendMode('personal')}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    <div className="text-xs">
                      <div className="font-bold">حسابي الشخصي فقط</div>
                      <div className="text-[10px] opacity-75">محادثة تليجرام الخاصة بي</div>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            {/* SECTION 3: 🤖 Telegram Bot Token Configuration */}
            <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-bold text-slate-200">
                  <Bot className="w-4 h-4 text-sky-400" />
                  <span>3. مفتاح البوت (Telegram Bot Token)</span>
                </div>
                {botUsername && (
                  <span className="text-[11px] text-sky-300 font-mono bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/20">
                    @{botUsername}
                  </span>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                  <span>رمز توكن البوت (Bot Token) من @BotFather</span>
                  {status?.hasBotToken && (
                    <span className="text-emerald-400 text-[11px] flex items-center gap-1 font-normal">
                      <CheckCircle className="w-3 h-3" /> تم تعيينه مسبقاً
                    </span>
                  )}
                </label>
                <div className="relative">
                  <input
                    type={showToken ? 'text' : 'password'}
                    value={botToken}
                    onChange={(e) => setBotToken(e.target.value)}
                    placeholder={status?.hasBotToken ? "اتركه فارغاً للإبقاء على التوكن الحالي أو أدخل توكن جديد لتغييره" : "مثال: 123456789:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw"}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 font-mono text-left"
                    dir="ltr"
                  />
                  <button
                    type="button"
                    onClick={() => setShowToken(!showToken)}
                    className="absolute left-3 top-2.5 text-slate-400 hover:text-white transition-colors"
                  >
                    {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Success Message */}
            {saveSuccessMsg && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-300 text-xs flex items-center gap-2">
                <Check className="w-4 h-4 shrink-0" />
                <span>{saveSuccessMsg}</span>
              </div>
            )}

            {/* Test Result Message */}
            {testResult && (
              <div className={`p-3.5 border rounded-xl text-xs flex items-start gap-2.5 ${
                testResult.success 
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' 
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
              }`}>
                {testResult.success ? <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" /> : <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />}
                <div className="space-y-1">
                  <div className="font-bold">{testResult.success ? 'نتيجة الفحص التجريبي:' : 'فشل الفحص التجريبي:'}</div>
                  <div className="text-[11px] opacity-90 leading-relaxed whitespace-pre-line">{testResult.message}</div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
              <button
                type="submit"
                disabled={saving}
                className="w-full sm:w-auto px-6 py-2.5 bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white text-sm font-semibold rounded-xl shadow-lg shadow-sky-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                <span>حفظ كافة الإعدادات</span>
              </button>

              <button
                type="button"
                onClick={handleTest}
                disabled={testing}
                className="w-full sm:w-auto px-5 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 text-slate-200 text-sm font-semibold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {testing ? <RefreshCw className="w-4 h-4 animate-spin text-sky-400" /> : <Zap className="w-4 h-4 text-amber-400" />}
                <span>إرسال رسالة فحص تجريبية الآن ⚡</span>
              </button>
            </div>
          </form>
        </div>

        {/* Quick Instructions Card */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center gap-2 text-white font-bold text-base border-b border-white/5 pb-3">
            <Sparkles className="w-5 h-5 text-amber-400" />
            <span>كيف يعمل الربط السريع بسهولة؟</span>
          </div>

          <div className="space-y-3.5 text-xs text-slate-300 leading-relaxed">
            <div className="p-3 bg-white/5 rounded-xl border border-white/5 space-y-1">
              <div className="font-bold text-sky-300">1. تسجيل رقمك واسمك</div>
              <p className="text-slate-400 text-[11px]">
                أدخل رقم هاتفك المسجل في تليجرام واسم حسابك، ليتم اعتماده كحساب أساسي مستلم.
              </p>
            </div>

            <div className="p-3 bg-white/5 rounded-xl border border-white/5 space-y-1">
              <div className="font-bold text-amber-300">2. الربط التلقائي بضغطة واحدة</div>
              <p className="text-slate-400 text-[11px]">
                اضغط على زر <strong>"1. فتح البوت والضغط على Start"</strong>، ثم اضغط زر <strong>"2. كشف وربط حسابي تلقائياً"</strong>، وسيقوم النظام بالتعرف على حسابك وتثبيته فوراً!
              </p>
            </div>

            <div className="p-3 bg-white/5 rounded-xl border border-white/5 space-y-1">
              <div className="font-bold text-purple-300">3. إرسال لجروب باسم الجروب</div>
              <p className="text-slate-400 text-[11px]">
                إذا كان لديك جروب، أضف البوت إلى الجروب واكتب اسم الجروب (مثل <code>@my_group</code>)، وسيتم إرسال الملفات داخل الجروب باسم حسابك ورقم هاتفك المسجل.
              </p>
            </div>

            <div className="p-3 bg-emerald-950/30 border border-emerald-500/20 rounded-xl space-y-1 text-emerald-200">
              <div className="font-bold flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>حماية ملفات المدير 100%</span>
              </div>
              <p className="text-[11px] text-slate-400">
                ملفاتك التي ترفعها كمدير لا ترسل إطلاقاً إلى تيليجرام ومستثناة بأمان تام.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Real-time File Forwarding Logs Table */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/5 pb-4">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-sky-400" />
            <h3 className="text-lg font-bold text-white">سجل إرسال الملفات المرفوعة إلى Telegram (Live Activity Logs)</h3>
          </div>
          <span className="text-xs text-slate-400 bg-white/5 px-3 py-1 rounded-full border border-white/5">
            آخر {status?.recentLogs?.length || 0} عملية إرسال
          </span>
        </div>

        {status?.recentLogs && status.recentLogs.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-right">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="py-3 px-3 font-semibold">الملف والصيغة</th>
                  <th className="py-3 px-3 font-semibold">الحجم</th>
                  <th className="py-3 px-3 font-semibold">المستخدم الرفع</th>
                  <th className="py-3 px-3 font-semibold">المصدر / الأداة</th>
                  <th className="py-3 px-3 font-semibold">حالة الإرسال لـ Telegram</th>
                  <th className="py-3 px-3 font-semibold">التاريخ والوقت</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {status.recentLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-white/[0.02] transition-colors">
                    {/* File info */}
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 shrink-0 font-bold uppercase text-[10px]">
                          {log.extension || 'FILE'}
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-white truncate max-w-[200px]" title={log.fileName}>
                            {log.fileName}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {log.category.toUpperCase()}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Size */}
                    <td className="py-3 px-3 text-slate-300 font-mono">
                      {log.fileSizeFormatted}
                    </td>

                    {/* User */}
                    <td className="py-3 px-3">
                      <div className="text-slate-200 font-medium">{log.userName}</div>
                      {log.userEmail && (
                        <div className="text-[10px] text-slate-400 truncate max-w-[140px]" title={log.userEmail}>
                          {log.userEmail}
                        </div>
                      )}
                    </td>

                    {/* Source Feature */}
                    <td className="py-3 px-3 text-slate-300">
                      <span className="px-2 py-0.5 bg-slate-800 border border-slate-700 rounded text-[10px]">
                        {log.sourceFeature}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="py-3 px-3">
                      {log.status === 'sent' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[10px] font-semibold">
                          <CheckCircle className="w-3 h-3" />
                          تم الإرسال بنجاح {log.telegramMessageId ? `(#${log.telegramMessageId})` : ''}
                        </span>
                      )}
                      {log.status === 'excluded_admin' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 text-[10px] font-semibold" title={log.reason}>
                          <ShieldCheck className="w-3 h-3" />
                          مستثنى (حساب مدير) 🛡️
                        </span>
                      )}
                      {log.status === 'failed' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-300 border border-rose-500/30 text-[10px] font-semibold" title={log.reason}>
                          <AlertCircle className="w-3 h-3" />
                          تعذر الإرسال
                        </span>
                      )}
                      {log.status === 'not_configured' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[10px] font-semibold" title={log.reason}>
                          <Info className="w-3 h-3" />
                          بانتظار المفاتيح
                        </span>
                      )}
                    </td>

                    {/* Timestamp */}
                    <td className="py-3 px-3 text-slate-400 text-[11px] whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString('ar-EG', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-10 border border-dashed border-slate-800 rounded-xl">
            <Send className="w-10 h-10 text-slate-600 mx-auto mb-2 opacity-50" />
            <div className="text-sm text-slate-400 font-semibold">لا توجد عمليات إرسال مسجلة حتى الآن</div>
            <p className="text-xs text-slate-500 mt-1">عند قيام أي مستخدم برفع ملف على الموقع، ستظهر العمليات وسجلات الإرسال هنا فورياً.</p>
          </div>
        )}
      </div>
    </div>
  );
};
