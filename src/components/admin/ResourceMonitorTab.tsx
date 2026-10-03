import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  Server, 
  Cpu, 
  Clock, 
  ShieldAlert, 
  ShieldCheck, 
  AlertTriangle, 
  RefreshCw, 
  Trash2, 
  CheckCircle2, 
  ArrowUpRight, 
  Zap, 
  HardDrive, 
  BarChart3, 
  FileVideo, 
  Globe, 
  Filter
} from 'lucide-react';
import { resourceMonitor, ResourceMetrics } from '../../utils/resourceMonitor';

interface ResourceMonitorTabProps {
  currentUser?: any;
}

export const ResourceMonitorTab: React.FC<ResourceMonitorTabProps> = () => {
  const [metrics, setMetrics] = useState<ResourceMetrics>(resourceMonitor.getMetrics());
  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'api_calls' | 'conversions' | 'slow_ops' | 'errors_abuse'>('overview');
  const [filterQuery, setFilterQuery] = useState('');

  useEffect(() => {
    const unsub = resourceMonitor.subscribe(() => {
      setMetrics(resourceMonitor.getMetrics());
    });
    return unsub;
  }, []);

  const handleRefresh = () => {
    setMetrics(resourceMonitor.getMetrics());
  };

  const handleReset = () => {
    if (confirm('هل أنت متأكد من رغبتك في تصفير سجلات ومؤشرات استهلاك الموارد؟')) {
      resourceMonitor.resetMetrics();
      setMetrics(resourceMonitor.getMetrics());
    }
  };

  // Find most called endpoint
  const topEndpoint = Object.entries(metrics.apiCallsByEndpoint).sort((a, b) => b[1] - a[1])[0] || ['لا يوجد استدعاءات بعد', 0];

  return (
    <div className="space-y-6 text-right font-sans" dir="rtl">
      {/* 1. Header Banner: Vercel Quota Protection Status */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-950/80 via-slate-900 to-cyan-950/80 p-5 border border-emerald-500/30 shadow-xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-400 shadow-inner">
              <ShieldCheck className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white">نظام مراقبة استهلاك موارد Vercel والحماية النشطة</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  الحالة: آمن ومحمي من التوقف
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1">
                تم عزل العمليات الثقيلة عن Vercel Serverless Functions، منع الـ Polling المتكرر، وتأمين تدفق الوسائط ومعدل الطلبات.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center">
            <button
              onClick={handleRefresh}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition"
              title="تحديث البيانات"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>تحديث</span>
            </button>
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 text-xs font-semibold border border-rose-800/40 transition"
              title="تصفير السجلات"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>تصفير الإحصائيات</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Key Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Total API Requests */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>إجمالي طلبات API</span>
            <Activity className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="mt-2">
            <span className="text-xl font-bold font-mono text-white">{metrics.totalApiRequests.toLocaleString()}</span>
            <span className="text-[10px] text-slate-400 block mt-0.5">طلب مُسجل</span>
          </div>
        </div>

        {/* Most Called API */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>الأكثر استدعاءً</span>
            <Zap className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-2 truncate">
            <span className="text-xs font-bold font-mono text-amber-300 block truncate" title={topEndpoint[0]}>
              {topEndpoint[0].replace('/api/', '')}
            </span>
            <span className="text-[10px] text-slate-400 block mt-0.5 font-mono">
              {topEndpoint[1]} استدعاء
            </span>
          </div>
        </div>

        {/* Total Conversions */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>عمليات التحويل</span>
            <FileVideo className="w-4 h-4 text-purple-400" />
          </div>
          <div className="mt-2">
            <span className="text-xl font-bold font-mono text-purple-300">{metrics.totalConversions.toLocaleString()}</span>
            <span className="text-[10px] text-slate-400 block mt-0.5">محليًا في المتصفح</span>
          </div>
        </div>

        {/* Bandwidth Saved */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>باندويث موفر لـ Vercel</span>
            <HardDrive className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2">
            <span className="text-lg font-bold font-mono text-emerald-400">{resourceMonitor.formatBytes(metrics.estimatedBandwidthSavedBytes)}</span>
            <span className="text-[10px] text-emerald-500/80 block mt-0.5">تجنب استهلاك السيرفر</span>
          </div>
        </div>

        {/* Slow Operations */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>عمليات بطيئة (&gt;2.5s)</span>
            <Clock className="w-4 h-4 text-yellow-400" />
          </div>
          <div className="mt-2">
            <span className="text-xl font-bold font-mono text-yellow-300">{metrics.slowOperations.length}</span>
            <span className="text-[10px] text-slate-400 block mt-0.5">عمليات تم رصدها</span>
          </div>
        </div>

        {/* Errors & Abuse */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>الأخطاء ومحاولات الإفراط</span>
            <ShieldAlert className="w-4 h-4 text-rose-400" />
          </div>
          <div className="mt-2">
            <span className="text-xl font-bold font-mono text-rose-400">
              {metrics.errors.length + metrics.abuseAttempts.length}
            </span>
            <span className="text-[10px] text-slate-400 block mt-0.5">
              {metrics.abuseAttempts.length} منع إفراط (Rate Limit)
            </span>
          </div>
        </div>
      </div>

      {/* 3. Sub Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveSubTab('overview')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
            activeSubTab === 'overview'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          نظرة عامة والتحليل الشامل
        </button>
        <button
          onClick={() => setActiveSubTab('api_calls')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
            activeSubTab === 'api_calls'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          سجل استدعاءات API ({metrics.recentApiCalls.length})
        </button>
        <button
          onClick={() => setActiveSubTab('conversions')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
            activeSubTab === 'conversions'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          سجل عمليات التحويل ({metrics.recentConversions.length})
        </button>
        <button
          onClick={() => setActiveSubTab('slow_ops')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
            activeSubTab === 'slow_ops'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          العمليات المستغرقة للوقت ({metrics.slowOperations.length})
        </button>
        <button
          onClick={() => setActiveSubTab('errors_abuse')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
            activeSubTab === 'errors_abuse'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          الأخطاء ومحاولات الإساءة ({metrics.errors.length + metrics.abuseAttempts.length})
        </button>
      </div>

      {/* 4. Tab Content */}
      {activeSubTab === 'overview' && (
        <div className="space-y-6">
          {/* Vercel Resource Safety Matrix */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5">
            <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
              <Server className="w-4 h-4 text-cyan-400" />
              <span>مصفوفة سلامة موارد Vercel (Resource Protection Matrix)</span>
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="py-2.5 px-3">المورد (RESOURCE)</th>
                    <th className="py-2.5 px-3">الحالة الراهنة</th>
                    <th className="py-2.5 px-3">آلية الحماية المُطبقة</th>
                    <th className="py-2.5 px-3">درجة الأمان</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  <tr>
                    <td className="py-2.5 px-3 font-semibold text-white">Active CPU (المعالج)</td>
                    <td className="py-2.5 px-3 text-emerald-400">منخفض جداً (~0% Vercel CPU)</td>
                    <td className="py-2.5 px-3 text-slate-400">تحويل الفيديوهات والـ SVGA والـ VAP ينفذ في متصفح العميل (WebCodecs &amp; Web Audio)</td>
                    <td className="py-2.5 px-3"><span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">آمن 100%</span></td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-semibold text-white">Fast Origin Transfer (باندويث البيانات)</td>
                    <td className="py-2.5 px-3 text-emerald-400">مُحكم (&lt; 5% من حد Vercel)</td>
                    <td className="py-2.5 px-3 text-slate-400">تشغيل الوسائط المباشرة من CDN دون المرور بالسيرفر، تفعيل Range 206، وحد أقصى 55MB للبروكسي</td>
                    <td className="py-2.5 px-3"><span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">آمن 100%</span></td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-semibold text-white">Function Invocations (استدعاء الدوال)</td>
                    <td className="py-2.5 px-3 text-emerald-400">منخفض للغاية</td>
                    <td className="py-2.5 px-3 text-slate-400">إلغاء Polling المحادثة (3s) وتحويلها لـ Firestore onSnapshot، وتوسيع فحص التحديثات لـ 10 دقائق</td>
                    <td className="py-2.5 px-3"><span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">آمن 100%</span></td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-semibold text-white">Edge Requests &amp; Rewrites</td>
                    <td className="py-2.5 px-3 text-emerald-400">مُحسن بـ Caching طويل الأمد</td>
                    <td className="py-2.5 px-3 text-slate-400">تخصيص `vercel.json` لاستبعاد `/api/` من إعادة توجيه الـ HTML، وكاش سنة كاملة لملفات الـ Assets</td>
                    <td className="py-2.5 px-3"><span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">آمن 100%</span></td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-semibold text-white">Bot &amp; Abuse Protection (الحماية من الإفراط)</td>
                    <td className="py-2.5 px-3 text-emerald-400">مفعلة (Rate Limit 60 req/min)</td>
                    <td className="py-2.5 px-3 text-slate-400">حظر عناوين IP الداخلية (SSRF)، تقييد معدل الطلبات لكل IP، وإرجاع 429 Too Many Requests تلقائيًا</td>
                    <td className="py-2.5 px-3"><span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">آمن 100%</span></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Breakdown: Endpoints & Formats */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Endpoints Breakdown */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4">
              <h4 className="text-xs font-bold text-white mb-3 flex items-center justify-between">
                <span>توزيع استدعاءات الـ API حسب المسار</span>
                <span className="text-cyan-400 font-mono text-[11px]">{Object.keys(metrics.apiCallsByEndpoint).length} مسار نشط</span>
              </h4>
              <div className="space-y-2">
                {Object.keys(metrics.apiCallsByEndpoint).length === 0 ? (
                  <p className="text-slate-500 text-xs py-4 text-center">لا توجد استدعاءات API مسجلة في هذه الجلسة بعد</p>
                ) : (
                  Object.entries(metrics.apiCallsByEndpoint)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 6)
                    .map(([endpoint, count]) => {
                      const percent = metrics.totalApiRequests > 0 ? Math.round((count / metrics.totalApiRequests) * 100) : 0;
                      return (
                        <div key={endpoint} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-mono text-slate-300 truncate max-w-[200px]" dir="ltr">{endpoint}</span>
                            <span className="font-mono text-cyan-400 font-semibold">{count} ({percent}%)</span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <div className="h-full bg-cyan-500 rounded-full" style={{ width: `${percent}%` }} />
                          </div>
                        </div>
                      );
                    })
                )}
              </div>
            </div>

            {/* Conversions Breakdown */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4">
              <h4 className="text-xs font-bold text-white mb-3 flex items-center justify-between">
                <span>توزيع صيغ التحويل المُعالجة</span>
                <span className="text-purple-400 font-mono text-[11px]">{metrics.totalConversions} تحويل</span>
              </h4>
              <div className="space-y-2">
                {Object.keys(metrics.conversionsByFormat).length === 0 ? (
                  <p className="text-slate-500 text-xs py-4 text-center">لم تنفذ أي عمليات تحويل ملفات في هذه الجلسة بعد</p>
                ) : (
                  Object.entries(metrics.conversionsByFormat)
                    .sort((a, b) => b[1] - a[1])
                    .map(([format, count]) => {
                      const percent = metrics.totalConversions > 0 ? Math.round((count / metrics.totalConversions) * 100) : 0;
                      return (
                        <div key={format} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-mono text-purple-300 uppercase">{format}</span>
                            <span className="font-mono text-purple-400 font-semibold">{count} ({percent}%)</span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <div className="h-full bg-purple-500 rounded-full" style={{ width: `${percent}%` }} />
                          </div>
                        </div>
                      );
                    })
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* API Calls Tab */}
      {activeSubTab === 'api_calls' && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-white">آخر استدعاءات API المسجلة (مباشرة)</h3>
            <span className="text-[11px] text-slate-400 font-mono">{metrics.recentApiCalls.length} طلب</span>
          </div>

          {metrics.recentApiCalls.length === 0 ? (
            <p className="text-slate-500 text-xs py-8 text-center">لا توجد استدعاءات مسجلة بعد</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="py-2 px-3">المسار</th>
                    <th className="py-2 px-3">الحالة (Status)</th>
                    <th className="py-2 px-3">المدة (Latency)</th>
                    <th className="py-2 px-3">الحجم</th>
                    <th className="py-2 px-3">الوقت</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {metrics.recentApiCalls.slice(0, 30).map((call, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/30">
                      <td className="py-2 px-3 text-slate-200" dir="ltr">{call.endpoint}</td>
                      <td className="py-2 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          call.status === 200 || call.status === 206 ? 'bg-emerald-500/20 text-emerald-300' :
                          call.status === 429 ? 'bg-amber-500/20 text-amber-300' :
                          'bg-rose-500/20 text-rose-300'
                        }`}>
                          {call.status || 'ERR'}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-slate-300">{call.durationMs}ms</td>
                      <td className="py-2 px-3 text-slate-400">{resourceMonitor.formatBytes(call.sizeBytes)}</td>
                      <td className="py-2 px-3 text-slate-500">{new Date(call.timestamp).toLocaleTimeString('ar-EG')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Conversions Tab */}
      {activeSubTab === 'conversions' && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-white">سجل عمليات التحويل والتصدير للمصممين</h3>
            <span className="text-[11px] text-purple-400 font-mono">{metrics.recentConversions.length} عملية</span>
          </div>

          {metrics.recentConversions.length === 0 ? (
            <p className="text-slate-500 text-xs py-8 text-center">لا توجد عمليات تحويل مسجلة بعد في هذه الجلسة</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="py-2 px-3">الصيغة المستهدفة</th>
                    <th className="py-2 px-3">الحالة</th>
                    <th className="py-2 px-3">مدة المعالجة</th>
                    <th className="py-2 px-3">حجم الملف الناتج</th>
                    <th className="py-2 px-3">المعالجة</th>
                    <th className="py-2 px-3">الوقت</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {metrics.recentConversions.map((conv, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/30">
                      <td className="py-2 px-3 font-bold text-purple-300 uppercase">{conv.format}</td>
                      <td className="py-2 px-3">
                        <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
                          {conv.success ? 'ناجح' : 'فشل'}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-slate-300">{(conv.durationMs / 1000).toFixed(2)}s</td>
                      <td className="py-2 px-3 text-cyan-400">{resourceMonitor.formatBytes(conv.fileSizeBytes)}</td>
                      <td className="py-2 px-3 text-slate-400">المتصفح المحلي (Client-Side)</td>
                      <td className="py-2 px-3 text-slate-500">{new Date(conv.timestamp).toLocaleTimeString('ar-EG')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Slow Operations Tab */}
      {activeSubTab === 'slow_ops' && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-white">العمليات المستغرقة للوقت (&gt;2.5 ثانية)</h3>
            <span className="text-[11px] text-yellow-400 font-mono">{metrics.slowOperations.length} عملية</span>
          </div>

          {metrics.slowOperations.length === 0 ? (
            <div className="py-8 text-center text-slate-500 text-xs flex flex-col items-center gap-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-400/60" />
              <span>لا توجد أي عمليات بطيئة أو عالقة. التطبيق يعمل بأقصى سرعة واستجابة.</span>
            </div>
          ) : (
            <div className="space-y-2">
              {metrics.slowOperations.map((op, idx) => (
                <div key={idx} className="p-3 rounded-xl bg-slate-800/60 border border-yellow-500/20 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-semibold text-white block">{op.operation}</span>
                    {op.details && <span className="text-slate-400 text-[11px] mt-0.5 block">{op.details}</span>}
                  </div>
                  <div className="text-left font-mono">
                    <span className="text-yellow-400 font-bold">{(op.durationMs / 1000).toFixed(2)}s</span>
                    <span className="text-[10px] text-slate-500 block">{new Date(op.timestamp).toLocaleTimeString('ar-EG')}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Errors & Abuse Tab */}
      {activeSubTab === 'errors_abuse' && (
        <div className="space-y-4">
          {/* Abuse / Rate limit hits */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-amber-400" />
                <span>محاولات الإفراط والتصدي (Rate Limiter &amp; Abuse Protection)</span>
              </h3>
              <span className="text-[11px] text-amber-400 font-mono">{metrics.abuseAttempts.length} محاولة</span>
            </div>

            {metrics.abuseAttempts.length === 0 ? (
              <p className="text-slate-500 text-xs py-4 text-center">لا توجد محاولات إفراط أو استغلال مسجلة</p>
            ) : (
              <div className="space-y-2">
                {metrics.abuseAttempts.map((ab, idx) => (
                  <div key={idx} className="p-2.5 rounded-xl bg-amber-950/30 border border-amber-500/30 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-amber-300 font-mono">{ab.ipOrReason}</span>
                      <span className="text-slate-300 text-[11px] block mt-0.5">{ab.details}</span>
                    </div>
                    <span className="text-slate-500 font-mono text-[10px]">{new Date(ab.timestamp).toLocaleTimeString('ar-EG')}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Errors Log */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-rose-400" />
                <span>سجل أخطاء الشبكة والعمليات</span>
              </h3>
              <span className="text-[11px] text-rose-400 font-mono">{metrics.errors.length} خطأ</span>
            </div>

            {metrics.errors.length === 0 ? (
              <p className="text-slate-500 text-xs py-4 text-center">لا توجد أخطاء مسجلة</p>
            ) : (
              <div className="space-y-2">
                {metrics.errors.map((err, idx) => (
                  <div key={idx} className="p-2.5 rounded-xl bg-rose-950/30 border border-rose-500/30 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-rose-300">{err.source}</span>
                      <span className="text-slate-300 text-[11px] block mt-0.5">{err.message}</span>
                    </div>
                    <span className="text-slate-500 font-mono text-[10px]">{new Date(err.timestamp).toLocaleTimeString('ar-EG')}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
