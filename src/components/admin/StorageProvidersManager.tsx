import React, { useState, useEffect } from 'react';
import { 
  Server, ShieldCheck, RefreshCw, Plus, CheckCircle2, XCircle, 
  AlertTriangle, ArrowRightLeft, Cpu, Globe, Key, Trash2, Edit3, 
  Play, Database, Layers, Sparkles, ExternalLink, Activity
} from 'lucide-react';
import { 
  StorageProviderConfig, 
  StorageProviderType, 
  ProviderTestResult, 
  AutoDetectResult, 
  FileMigrationJob 
} from '../../types';
import { 
  fetchStorageProviders, 
  saveStorageProvider, 
  testStorageProvider, 
  switchPrimaryProvider, 
  updateFailoverSettings, 
  autoDetectProvider, 
  startFileMigration, 
  fetchMigrationStatus,
  formatBytes 
} from '../../services/megaStorageService';

interface StorageProvidersManagerProps {
  showNotification: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

export const StorageProvidersManager: React.FC<StorageProvidersManagerProps> = ({ showNotification }) => {
  const [providers, setProviders] = useState<StorageProviderConfig[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  
  // Modal states
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [showSwitchModal, setShowSwitchModal] = useState<boolean>(false);
  const [showTestModal, setShowTestModal] = useState<boolean>(false);
  const [showMigrationModal, setShowMigrationModal] = useState<boolean>(false);

  // Active selections
  const [selectedProviderForSwitch, setSelectedProviderForSwitch] = useState<StorageProviderConfig | null>(null);
  const [testResult, setTestResult] = useState<ProviderTestResult | null>(null);
  const [testingProviderId, setTestingProviderId] = useState<string | null>(null);

  // Form states for Add / Edit Provider
  const [editingProvider, setEditingProvider] = useState<Partial<StorageProviderConfig>>({
    name: '',
    type: 'custom',
    website: '',
    apiBaseUrl: '',
    uploadEndpoint: '/upload',
    deleteEndpoint: '/delete',
    downloadUrlPattern: '',
    apiKey: '',
    secretKey: '',
    authType: 'bearer',
    maxFileSizeMB: 250
  });

  // Auto Detect State
  const [autoDetectUrl, setAutoDetectUrl] = useState<string>('');
  const [detecting, setDetecting] = useState<boolean>(false);
  const [detectResult, setDetectResult] = useState<AutoDetectResult | null>(null);

  // Migration State
  const [sourceProviderId, setSourceProviderId] = useState<string>('');
  const [targetProviderId, setTargetProviderId] = useState<string>('');
  const [migrationFilter, setMigrationFilter] = useState<'all' | 'selected' | 'active_only'>('all');
  const [keepOriginals, setKeepOriginals] = useState<boolean>(true);
  const [migrationJob, setMigrationJob] = useState<FileMigrationJob | null>(null);
  const [migrating, setMigrating] = useState<boolean>(false);

  // Failover state
  const [backupProviderId, setBackupProviderId] = useState<string>('');
  const [failoverEnabled, setFailoverEnabled] = useState<boolean>(true);

  const primaryProvider = providers.find(p => p.isActivePrimary);
  const backupProvider = providers.find(p => p.isActiveBackup);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await fetchStorageProviders();
      setProviders(data);

      const backup = data.find(p => p.isActiveBackup);
      if (backup) setBackupProviderId(backup.id);

      const job = await fetchMigrationStatus();
      if (job) setMigrationJob(job);
    } catch (err: any) {
      showNotification('فشل جلب قائمة مزودي التخزين', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Handle Auto Detect
  const handleRunAutoDetect = async () => {
    if (!autoDetectUrl.trim()) {
      showNotification('يرجى كتابة رابط موقع أو API التخزين', 'warning');
      return;
    }
    setDetecting(true);
    setDetectResult(null);
    try {
      const res = await autoDetectProvider(autoDetectUrl.trim());
      setDetectResult(res);

      if (res.detected && res.suggestedConfig) {
        setEditingProvider(prev => ({
          ...prev,
          ...res.suggestedConfig
        }));
        showNotification(res.message, 'success');
      } else {
        showNotification(res.message, 'info');
      }
    } catch (err: any) {
      showNotification('فشل فحص الرابط التلقائي', 'error');
    } finally {
      setDetecting(false);
    }
  };

  // Handle Save Provider
  const handleSaveProvider = async () => {
    if (!editingProvider.name?.trim()) {
      showNotification('يرجى إدخال اسم مزود التخزين', 'warning');
      return;
    }
    try {
      const res = await saveStorageProvider(editingProvider);
      if (res.success) {
        showNotification(res.message, 'success');
        setShowAddModal(false);
        setEditingProvider({
          name: '',
          type: 'custom',
          website: '',
          apiBaseUrl: '',
          uploadEndpoint: '/upload',
          deleteEndpoint: '/delete',
          downloadUrlPattern: '',
          apiKey: '',
          secretKey: '',
          authType: 'bearer',
          maxFileSizeMB: 250
        });
        setDetectResult(null);
        setAutoDetectUrl('');
        loadData();
      }
    } catch (err: any) {
      showNotification(err.message || 'فشل حفظ مزود التخزين', 'error');
    }
  };

  // Handle Switch Provider
  const handleConfirmSwitch = async () => {
    if (!selectedProviderForSwitch) return;
    try {
      const res = await switchPrimaryProvider(selectedProviderForSwitch.id);
      if (res.success) {
        showNotification(res.message, 'success');
        setShowSwitchModal(false);
        setSelectedProviderForSwitch(null);
        loadData();
      }
    } catch (err: any) {
      showNotification(err.message || 'فشل تغيير المزود الرئيسي', 'error');
    }
  };

  // Handle Test Provider
  const handleRunTestProvider = async (provider: StorageProviderConfig) => {
    setTestingProviderId(provider.id);
    setTestResult(null);
    setShowTestModal(true);
    try {
      const res = await testStorageProvider(provider.id, provider);
      setTestResult(res);
      if (res.overallSuccess) {
        showNotification('✓ نجحت جميع اختبارات الاتصال والرفع والتنزيل لهذا المزود!', 'success');
      } else {
        showNotification('تنبيه: فشل بعض أجزاء اختبار التخزين', 'warning');
      }
    } catch (err: any) {
      showNotification('حدث خطأ أثناء تشغيل الفحص', 'error');
    } finally {
      setTestingProviderId(null);
    }
  };

  // Handle Update Failover
  const handleSaveFailover = async (newBackupId: string, enabled: boolean) => {
    setBackupProviderId(newBackupId);
    setFailoverEnabled(enabled);
    try {
      const res = await updateFailoverSettings(newBackupId, enabled);
      if (res.success) {
        showNotification(res.message, 'success');
        loadData();
      }
    } catch (err: any) {
      showNotification('فشل تحديث إعدادات Failover', 'error');
    }
  };

  // Handle Start Migration
  const handleStartMigration = async () => {
    if (!sourceProviderId || !targetProviderId) {
      showNotification('يرجى اختيار المزود المصدر والمزود الهدف', 'warning');
      return;
    }
    if (sourceProviderId === targetProviderId) {
      showNotification('لا يمكن النقل لنفس المزود', 'warning');
      return;
    }
    setMigrating(true);
    try {
      const res = await startFileMigration(sourceProviderId, targetProviderId, {
        filterMode: migrationFilter,
        keepOriginalFiles: keepOriginals
      });
      if (res.success) {
        setMigrationJob(res.job);
        showNotification('تم بدء نقل الملفات بنجاح في الخلفية!', 'success');
      }
    } catch (err: any) {
      showNotification(err.message || 'فشل عملية النقل', 'error');
    } finally {
      setMigrating(false);
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Top Banner Header */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-indigo-500/30 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2.5 bg-indigo-500/20 rounded-xl border border-indigo-400/30 text-indigo-400">
                <Server className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold text-white">إدارة مزودي التخزين (Storage Providers)</h2>
            </div>
            <p className="text-sm text-slate-300 max-w-2xl">
              تغيير وتبديل موقع / مزود التخزين المستخدم في كاش النظام بكل حرية وبدون تعديل الكود الأساسي. يدعم ربط السيرفرات المخصصة، الـ Failover التلقائي، وتتبع الملفات القديمة على مزوداتها الأصلية.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setEditingProvider({
                  name: '',
                  type: 'custom',
                  website: '',
                  apiBaseUrl: '',
                  uploadEndpoint: '/upload',
                  deleteEndpoint: '/delete',
                  downloadUrlPattern: '',
                  apiKey: '',
                  secretKey: '',
                  authType: 'bearer',
                  maxFileSizeMB: 250
                });
                setShowAddModal(true);
              }}
              className="px-4 py-2.5 bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-500/25 transition-all flex items-center gap-2 border border-indigo-400/30"
            >
              <Plus className="w-4 h-4" />
              <span>+ Add Storage Provider</span>
            </button>

            <button
              onClick={() => setShowMigrationModal(true)}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-sm font-bold transition-all flex items-center gap-2"
            >
              <ArrowRightLeft className="w-4 h-4 text-emerald-400" />
              <span>Migrate Files</span>
            </button>
          </div>
        </div>
      </div>

      {/* Active Primary & Failover Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Active Primary Provider Card */}
        <div className="bg-slate-900/90 border border-emerald-500/30 rounded-2xl p-5 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full text-xs font-bold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              المزود الحالي المعتمد (ACTIVE PRIMARY)
            </span>
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
          </div>

          <div className="space-y-2">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              {primaryProvider?.name || 'Storage.to'}
              <span className="text-xs text-slate-400 font-normal">({primaryProvider?.type || 'storage_to'})</span>
            </h3>
            <p className="text-xs text-slate-400 flex items-center gap-1">
              <Globe className="w-3.5 h-3.5" />
              {primaryProvider?.website || 'https://storage.to'}
            </p>
            <div className="pt-2 border-t border-slate-800 text-xs text-slate-300 flex items-center justify-between">
              <span>جميع عمليات الرفع الجديدة تتوجه لهذا المزود مباشرة.</span>
              <span className="text-emerald-400 font-mono font-bold">100% Ready</span>
            </div>
          </div>
        </div>

        {/* Automatic Failover Settings Card */}
        <div className="bg-slate-900/90 border border-purple-500/30 rounded-2xl p-5 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="px-3 py-1 bg-purple-500/20 text-purple-400 border border-purple-500/30 rounded-full text-xs font-bold flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5" />
              التحويل التلقائي عند الفشل (AUTOMATIC FAILOVER)
            </span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={failoverEnabled}
                onChange={(e) => handleSaveFailover(backupProviderId, e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div>
            </label>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs text-slate-300 font-semibold">مزود النسخ الاحتياطي (Backup Provider):</label>
              <select
                value={backupProviderId}
                onChange={(e) => handleSaveFailover(e.target.value, failoverEnabled)}
                className="bg-slate-950 border border-slate-700 text-white rounded-lg text-xs px-2.5 py-1 focus:outline-none focus:border-purple-500"
              >
                <option value="">-- بدون مزود احتياطي --</option>
                {providers.filter(p => !p.isActivePrimary).map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({p.type})</option>
                ))}
              </select>
            </div>
            <p className="text-xs text-slate-400">
              في حال فشل المزود الرئيسي أثناء رفع ملف، يتحول النظام تلقائياً للمزود الاحتياطي ويستكمل الرفع بدون انقطاع الخدمة.
            </p>
          </div>
        </div>
      </div>

      {/* Storage Providers List */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-400" />
            <h3 className="text-lg font-bold text-white">المزودين المتاحين (Configured Providers)</h3>
          </div>
          <span className="text-xs text-slate-400">إجمالي المزودين: {providers.length}</span>
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-400">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-400" />
            <span>جاري تحميل إعدادات مزودي التخزين...</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {providers.map((p) => (
              <div
                key={p.id}
                className={`p-5 rounded-2xl border transition-all duration-200 flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                  p.isActivePrimary
                    ? 'bg-slate-900 border-emerald-500/50 shadow-lg shadow-emerald-950/20'
                    : p.isActiveBackup
                    ? 'bg-slate-900/90 border-purple-500/50'
                    : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700'
                }`}
              >
                {/* Left Info */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-3">
                    <h4 className="text-base font-bold text-white">{p.name}</h4>
                    {p.isActivePrimary && (
                      <span className="px-2.5 py-0.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full text-[11px] font-bold">
                        ACTIVE PRIMARY
                      </span>
                    )}
                    {p.isActiveBackup && (
                      <span className="px-2.5 py-0.5 bg-purple-500/20 text-purple-400 border border-purple-500/30 rounded-full text-[11px] font-bold">
                        BACKUP FAILOVER
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400">
                    <span className="flex items-center gap-1">
                      <Globe className="w-3.5 h-3.5 text-slate-500" />
                      {p.website || p.apiBaseUrl || 'Custom Host'}
                    </span>
                    <span className="flex items-center gap-1 font-mono text-slate-500">
                      Type: {p.type}
                    </span>
                    {p.maxFileSizeMB && (
                      <span>Max Size: {p.maxFileSizeMB} MB</span>
                    )}
                  </div>
                </div>

                {/* Right Actions */}
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => handleRunTestProvider(p)}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold border border-slate-700 transition-all flex items-center gap-1.5"
                  >
                    <Activity className="w-3.5 h-3.5 text-sky-400" />
                    <span>Test Provider</span>
                  </button>

                  {!p.isActivePrimary && (
                    <button
                      onClick={() => {
                        setSelectedProviderForSwitch(p);
                        setShowSwitchModal(true);
                      }}
                      className="px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Use This Provider</span>
                    </button>
                  )}

                  <button
                    onClick={() => {
                      setEditingProvider(p);
                      setShowAddModal(true);
                    }}
                    className="p-2 text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-800 rounded-xl transition-all"
                    title="تعديل الإعدادات"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Migration Job Progress Panel (If Active) */}
      {migrationJob && (
        <div className="bg-slate-900 border border-emerald-500/30 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <RefreshCw className={`w-5 h-5 text-emerald-400 ${migrationJob.status === 'running' ? 'animate-spin' : ''}`} />
              <h3 className="text-base font-bold text-white">حالة نقل الملفات (File Migration System)</h3>
            </div>
            <span className="text-xs text-slate-400">
              {migrationJob.sourceProviderName} ← {migrationJob.targetProviderName}
            </span>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-xs text-slate-300">
              <span>نسبة الإنجاز: {migrationJob.percent}%</span>
              <span>المكتمل: {migrationJob.completedFiles} من إجمالي {migrationJob.totalFiles} ملف</span>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-3 bg-slate-950 rounded-full overflow-hidden p-0.5 border border-slate-800">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-300"
                style={{ width: `${migrationJob.percent}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
              <span>Processing: {migrationJob.processingFiles}</span>
              <span className="text-emerald-400">Completed: {migrationJob.completedFiles}</span>
              <span className={migrationJob.failedFiles > 0 ? 'text-red-400 font-bold' : 'text-slate-500'}>
                Failed: {migrationJob.failedFiles}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* -------------------- MODAL 1: Add / Edit Storage Provider -------------------- */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-6 my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Server className="w-5 h-5 text-indigo-400" />
                <span>+ Add / Edit Storage Provider</span>
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            {/* Auto Detect Section */}
            <div className="bg-indigo-950/40 border border-indigo-500/30 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-indigo-400" />
                  Auto Detect Provider (التعرف الذكي التلقائي)
                </span>
                <span className="text-[11px] text-slate-400">ادخل رابط السيرفر للفحص والربط الفوري</span>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="https://storage.example.com"
                  value={autoDetectUrl}
                  onChange={(e) => setAutoDetectUrl(e.target.value)}
                  className="flex-1 bg-slate-950 border border-slate-700 text-white rounded-xl text-xs px-3 py-2.5 focus:outline-none focus:border-indigo-500"
                />
                <button
                  onClick={handleRunAutoDetect}
                  disabled={detecting}
                  className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-1.5 shrink-0"
                >
                  {detecting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  <span>Auto Detect</span>
                </button>
              </div>

              {detectResult && (
                <div className={`p-3 rounded-xl border text-xs space-y-1.5 ${
                  detectResult.detected ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300' : 'bg-slate-950 border-slate-800 text-slate-300'
                }`}>
                  <div className="font-bold flex items-center gap-1.5">
                    {detectResult.detected ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertTriangle className="w-4 h-4 text-amber-400" />}
                    <span>{detectResult.message}</span>
                  </div>
                  {detectResult.detected && (
                    <div className="grid grid-cols-2 gap-2 pt-1 text-[11px] font-mono border-t border-emerald-500/20">
                      <span>API: {detectResult.apiSupported ? '✓ Supported' : '✕'}</span>
                      <span>Upload: {detectResult.uploadSupported ? '✓ Supported' : '✕'}</span>
                      <span>Download: {detectResult.downloadSupported ? '✓ Supported' : '✕'}</span>
                      <span>Delete: {detectResult.deleteSupported ? '✓ Supported' : '✕'}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Provider Form Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block text-slate-300 mb-1 font-semibold">Provider Name *</label>
                <input
                  type="text"
                  placeholder="Storage.to / Custom Provider"
                  value={editingProvider.name || ''}
                  onChange={(e) => setEditingProvider({ ...editingProvider, name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl p-2.5 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-semibold">Provider Type</label>
                <select
                  value={editingProvider.type || 'custom'}
                  onChange={(e) => setEditingProvider({ ...editingProvider, type: e.target.value as StorageProviderType })}
                  className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl p-2.5 focus:border-indigo-500"
                >
                  <option value="storage_to">Storage.to / MEGA</option>
                  <option value="cloudflare_r2">Cloudflare R2</option>
                  <option value="supabase">Supabase Storage</option>
                  <option value="custom">Custom Provider</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-semibold">API Base URL</label>
                <input
                  type="text"
                  placeholder="https://api.storage.com"
                  value={editingProvider.apiBaseUrl || ''}
                  onChange={(e) => setEditingProvider({ ...editingProvider, apiBaseUrl: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl p-2.5 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-semibold">Upload Endpoint</label>
                <input
                  type="text"
                  placeholder="/upload"
                  value={editingProvider.uploadEndpoint || '/upload'}
                  onChange={(e) => setEditingProvider({ ...editingProvider, uploadEndpoint: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl p-2.5 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-semibold">Download URL Pattern</label>
                <input
                  type="text"
                  placeholder="https://example.com/files/{id}"
                  value={editingProvider.downloadUrlPattern || ''}
                  onChange={(e) => setEditingProvider({ ...editingProvider, downloadUrlPattern: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl p-2.5 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-semibold">Delete Endpoint</label>
                <input
                  type="text"
                  placeholder="/delete"
                  value={editingProvider.deleteEndpoint || '/delete'}
                  onChange={(e) => setEditingProvider({ ...editingProvider, deleteEndpoint: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl p-2.5 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-semibold">API Key / Token</label>
                <input
                  type="password"
                  placeholder="sk_live_..."
                  value={editingProvider.apiKey || ''}
                  onChange={(e) => setEditingProvider({ ...editingProvider, apiKey: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl p-2.5 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-semibold">Authentication Type</label>
                <select
                  value={editingProvider.authType || 'bearer'}
                  onChange={(e) => setEditingProvider({ ...editingProvider, authType: e.target.value as any })}
                  className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl p-2.5 focus:border-indigo-500"
                >
                  <option value="bearer">Bearer Token</option>
                  <option value="api_key_header">API Key Header</option>
                  <option value="basic">Basic Auth</option>
                  <option value="aws_s3">AWS S3 SigV4</option>
                  <option value="none">Public / None</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveProvider}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-indigo-500/25"
              >
                Save Provider
              </button>
            </div>
          </div>
        </div>
      )}

      {/* -------------------- MODAL 2: Switch Provider Confirmation -------------------- */}
      {showSwitchModal && selectedProviderForSwitch && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center gap-3 text-amber-400">
              <div className="p-2.5 bg-amber-500/20 rounded-xl border border-amber-500/30">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white">Switch Storage Provider?</h3>
            </div>

            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Current:</span>
                <span className="text-white font-bold">{primaryProvider?.name || 'Storage.to'}</span>
              </div>
              <div className="flex justify-between text-emerald-400 font-bold border-t border-slate-800 pt-2">
                <span>New:</span>
                <span>{selectedProviderForSwitch.name}</span>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed bg-indigo-950/40 p-3 rounded-xl border border-indigo-500/20">
              New uploads will use the new provider.
              <br />
              <strong className="text-white">Existing files will remain connected to their original provider</strong> unless migration is enabled.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowSwitchModal(false)}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmSwitch}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-emerald-600/25"
              >
                Switch Provider
              </button>
            </div>
          </div>
        </div>
      )}

      {/* -------------------- MODAL 3: Test Provider Results -------------------- */}
      {showTestModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Activity className="w-5 h-5 text-sky-400" />
                <span>Provider Diagnostic Test</span>
              </h3>
              <button onClick={() => setShowTestModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            {testingProviderId && !testResult ? (
              <div className="py-8 text-center text-slate-300 space-y-3">
                <RefreshCw className="w-8 h-8 animate-spin mx-auto text-sky-400" />
                <p className="text-xs">جاري تشغيل الاختبار الحقيقي الشامل (7 خطوات)...</p>
              </div>
            ) : testResult ? (
              <div className="space-y-3">
                <div className={`p-3 rounded-xl border text-xs font-bold ${
                  testResult.overallSuccess ? 'bg-emerald-950/50 border-emerald-500/40 text-emerald-300' : 'bg-amber-950/50 border-amber-500/40 text-amber-300'
                }`}>
                  {testResult.overallSuccess ? '✓ Provider is ready for production' : '⚠️ Provider test finished with warnings'}
                </div>

                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {testResult.steps.map((step, idx) => (
                    <div key={idx} className="p-2.5 bg-slate-950 rounded-xl border border-slate-800 flex items-start gap-2.5 text-xs">
                      {step.success ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                      )}
                      <div>
                        <p className="font-bold text-white">{step.name}</p>
                        <p className="text-[11px] text-slate-400">{step.message}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setShowTestModal(false)}
                className="px-4 py-2 bg-slate-800 text-slate-200 rounded-xl text-xs font-semibold"
              >
                Close Test
              </button>
            </div>
          </div>
        </div>
      )}

      {/* -------------------- MODAL 4: Migration System -------------------- */}
      {showMigrationModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <ArrowRightLeft className="w-5 h-5 text-emerald-400" />
                <span>Migrate Files Between Providers</span>
              </h3>
              <button onClick={() => setShowMigrationModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">المزود المصدر (Source):</label>
                <select
                  value={sourceProviderId}
                  onChange={(e) => setSourceProviderId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl p-2.5"
                >
                  <option value="">-- اختر المصدر --</option>
                  {providers.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">المزود الهدف (Target):</label>
                <select
                  value={targetProviderId}
                  onChange={(e) => setTargetProviderId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl p-2.5"
                >
                  <option value="">-- اختر الهدف --</option>
                  {providers.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2 text-xs text-slate-300">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="filterMode"
                  checked={migrationFilter === 'all'}
                  onChange={() => setMigrationFilter('all')}
                  className="text-emerald-500"
                />
                <span>☑ Migrate All Files</span>
              </label>

              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="filterMode"
                  checked={migrationFilter === 'active_only'}
                  onChange={() => setMigrationFilter('active_only')}
                  className="text-emerald-500"
                />
                <span>☑ Migrate Only Active Files</span>
              </label>

              <label className="flex items-center gap-2 pt-2 border-t border-slate-800">
                <input
                  type="checkbox"
                  checked={keepOriginals}
                  onChange={(e) => setKeepOriginals(e.target.checked)}
                  className="rounded text-emerald-500"
                />
                <span>☑ Keep Original Files on Source Provider</span>
              </label>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                onClick={() => setShowMigrationModal(false)}
                className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleStartMigration}
                disabled={migrating}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-2"
              >
                {migrating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                <span>Start Migration</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
