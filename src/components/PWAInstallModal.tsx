import React, { useState } from 'react';
import { 
  Download, Smartphone, CheckCircle2, X, Share2, 
  MoreVertical, Sparkles, ExternalLink, QrCode, Copy, Check, FileDown, AlertCircle
} from 'lucide-react';

interface PWAInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
  isAndroid: boolean;
  isIOS: boolean;
  canInstallDirectly: boolean;
  onDirectInstall: () => void;
  isInstalled: boolean;
}

export const PWAInstallModal: React.FC<PWAInstallModalProps> = ({
  isOpen,
  onClose,
  isAndroid,
  isIOS,
  canInstallDirectly,
  onDirectInstall,
  isInstalled
}) => {
  const [copied, setCopied] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [showQr, setShowQr] = useState(false);

  if (!isOpen) return null;

  const currentUrl = typeof window !== 'undefined' 
    ? (window.location.origin && window.location.origin !== 'null' ? window.location.origin : window.location.href)
    : 'https://ais-dev-dpjzszh6gj74qtcjxvkzqc-53841237451.europe-west2.run.app';

  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(currentUrl)}&bgcolor=090e1c&color=38bdf8`;

  // Generate and download an Android standalone Web App installer file
  const handleDownloadAppFile = () => {
    try {
      const launcherContent = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
  <title>SVGA Genius Studio - تثبيت التطبيق</title>
  <meta name="theme-color" content="#090e1c">
  <meta name="mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <link rel="manifest" href="${currentUrl}/manifest.json">
  <link rel="icon" type="image/png" href="${currentUrl}/pwa-192x192.png">
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: #020617;
      color: #f8fafc;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      text-align: center;
      padding: 24px;
    }
    .card {
      background: #0f172a;
      border: 1px solid rgba(99, 102, 241, 0.4);
      border-radius: 28px;
      padding: 36px 28px;
      max-width: 420px;
      width: 100%;
      box-shadow: 0 25px 60px rgba(0,0,0,0.8);
    }
    .icon {
      width: 96px;
      height: 96px;
      border-radius: 22px;
      margin-bottom: 20px;
      box-shadow: 0 10px 30px rgba(99, 102, 241, 0.4);
    }
    .btn {
      display: block;
      width: 100%;
      padding: 16px;
      background: linear-gradient(135deg, #6366f1, #0ea5e9);
      color: white;
      text-decoration: none;
      font-weight: 800;
      border-radius: 18px;
      font-size: 16px;
      margin-top: 24px;
      box-shadow: 0 8px 25px rgba(14, 165, 233, 0.35);
    }
    .instructions {
      font-size: 13px;
      color: #94a3b8;
      line-height: 1.6;
      margin-top: 18px;
      background: rgba(255,255,255,0.03);
      padding: 12px;
      border-radius: 14px;
    }
  </style>
</head>
<body>
  <div class="card">
    <img src="${currentUrl}/pwa-192x192.png" class="icon" alt="SVGA Genius">
    <h2 style="margin: 0 0 8px 0; font-size: 22px;">SVGA Genius Studio</h2>
    <p style="color: #38bdf8; font-size: 14px; margin: 0 0 16px 0;">تطبيق أندرويد مستقل PWA</p>
    <p style="color: #cbd5e1; font-size: 14px; margin: 0;">اضغط على الزر أدناه لتشغيل وتثبيت التطبيق على جهازك مباشرة:</p>
    <a href="${currentUrl}/?standalone=true" class="btn">تشغيل وتثبيت التطبيق</a>
    <div class="instructions">
      💡 للتثبيت الدائم كأيقونة في هاتفك: افتح القائمة (⋮) بالمتصفح واختر <b>تثبيت التطبيق</b> أو <b>إضافة إلى الشاشة الرئيسية</b>.
    </div>
  </div>
  <script>
    setTimeout(function() {
      window.location.href = "${currentUrl}/?standalone=true";
    }, 1500);
  </script>
</body>
</html>`;

      const blob = new Blob([launcherContent], { type: 'text/html;charset=utf-8' });
      const downloadLink = document.createElement('a');
      downloadLink.href = URL.createObjectURL(blob);
      downloadLink.download = 'SVGA-Genius-Android-App.html';
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
      URL.revokeObjectURL(downloadLink.href);

      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 5000);
    } catch (err) {
      console.error('[PWA] Download failed:', err);
    }
  };

  const handleMainActionClick = async () => {
    // 1. Try native browser prompt if available
    onDirectInstall();

    // 2. Also trigger the real download so the user immediately receives the application file!
    handleDownloadAppFile();
  };

  const handleCopy = () => {
    try {
      navigator.clipboard.writeText(currentUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch (err) {
      console.warn('Copy failed:', err);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-lg max-h-[92vh] overflow-y-auto bg-[#0a0f1e] border border-indigo-500/30 rounded-3xl p-5 sm:p-7 shadow-[0_20px_60px_rgba(0,0,0,0.9)] text-white scrollbar-thin scrollbar-thumb-indigo-500/30"
        dir="rtl"
      >
        {/* Glow backdrop */}
        <div className="absolute top-0 right-1/4 w-64 h-64 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/4 w-64 h-64 bg-sky-600/15 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 left-5 p-2 rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-slate-400 hover:text-white transition-all cursor-pointer z-10"
          title="إغلاق"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header with App Logo and Badges */}
        <div className="flex items-center gap-4 mb-5">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 via-sky-500 to-indigo-700 p-0.5 shadow-xl shadow-indigo-500/25 shrink-0 flex items-center justify-center">
            <div className="w-full h-full rounded-2xl bg-[#090e1c] flex items-center justify-center overflow-hidden">
              <img src="/pwa-192x192.png" alt="App Logo" className="w-12 h-12 object-contain" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black text-white font-arabic">
                تنزيل وتثبيت التطبيق على الهاتف
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                PWA Android
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              تطبيق أندرويد حقيقي يعمل بدون متصفح ويدعم فتح الملفات مباشرة
            </p>
          </div>
        </div>

        {/* Installed State Notification */}
        {isInstalled && (
          <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-3.5 mb-5">
            <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
            <div>
              <p className="text-sm font-bold text-emerald-300">
                التطبيق مثبت بنجاح ويعمل بنظام Standalone!
              </p>
              <p className="text-xs text-emerald-200/70 mt-0.5">
                يمكنك فتح ملفات الرسوم والوسائط مباشرة من مدير ملفات الهاتف.
              </p>
            </div>
          </div>
        )}

        {/* Success Alert when file is downloaded */}
        {downloadSuccess && (
          <div className="p-4 rounded-2xl bg-sky-500/15 border border-sky-500/35 flex items-center gap-3 mb-5 animate-in fade-in slide-in-from-top-2 duration-300">
            <CheckCircle2 className="w-5 h-5 text-sky-400 shrink-0" />
            <div className="text-xs">
              <p className="font-bold text-sky-200">تم تنزيل ملف التطبيق (SVGA-Genius-Android-App.html) بنجاح!</p>
              <p className="text-sky-300/80 mt-0.5">افتح الملف من التنزيلات في هاتفك لتشغيل وتثبيت التطبيق فوراً.</p>
            </div>
          </div>
        )}

        {/* Primary Action Buttons */}
        <div className="space-y-3 mb-6">
          {/* Main Download & Install Button */}
          <button
            onClick={handleMainActionClick}
            className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-indigo-600 via-sky-600 to-indigo-600 hover:from-indigo-500 hover:to-sky-500 text-white font-black text-base shadow-xl shadow-indigo-600/35 hover:shadow-indigo-500/50 hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-3 cursor-pointer border border-indigo-400/40"
          >
            <Download className="w-5 h-5 animate-bounce text-sky-200" />
            <span>تنزيل وتثبيت التطبيق الآن على الهاتف</span>
          </button>

          {/* Direct Live URL Open (Crucial for bypassing iframe restrictions) */}
          <div className="grid grid-cols-2 gap-2.5">
            <a
              href={currentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="py-3 px-4 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/30 text-sky-200 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
              title="فتح الرابط في نافذة مستقلة ليظهر خيار التثبيت المباشر بالمتصفح"
            >
              <ExternalLink className="w-4 h-4 text-sky-400" />
              <span>فتح برابط مستقل</span>
            </a>

            <button
              onClick={() => setShowQr(!showQr)}
              className="py-3 px-4 rounded-xl bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/30 text-indigo-200 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <QrCode className="w-4 h-4 text-indigo-400" />
              <span>{showQr ? 'إخفاء الباركود' : 'مسح الباركود (QR)'}</span>
            </button>
          </div>
        </div>

        {/* QR Code Section for Scanning with Phone Camera */}
        {showQr && (
          <div className="mb-6 p-4 rounded-2xl bg-[#050a17] border border-sky-500/30 flex flex-col items-center justify-center text-center animate-in fade-in duration-200">
            <p className="text-xs font-bold text-sky-300 mb-3 flex items-center gap-2">
              <QrCode className="w-4 h-4 text-sky-400" />
              <span>امسح الباركود بكاميرا هاتفك لفتح وتثبيت التطبيق:</span>
            </p>
            <div className="p-3 bg-white rounded-2xl shadow-lg shadow-sky-500/10">
              <img 
                src={qrImageUrl} 
                alt="QR Code" 
                className="w-40 h-40 object-contain rounded-lg"
              />
            </div>
            <p className="text-[11px] text-slate-400 mt-2">
              وجه كاميرا الهاتف نحو الباركود واضغط على الرابط ليتم التثبيت مباشرة
            </p>
          </div>
        )}

        {/* Copy Direct Link Section */}
        <div className="mb-6 p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.08] flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0 text-right">
            <span className="text-[11px] text-slate-400 block font-medium">رابط التطبيق المباشر:</span>
            <span className="text-xs text-slate-200 font-mono truncate block text-left ltr mt-0.5">{currentUrl}</span>
          </div>
          <button
            onClick={handleCopy}
            className={`py-2 px-3.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
              copied 
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' 
                : 'bg-white/10 hover:bg-white/15 text-white border border-white/20'
            }`}
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-emerald-400" />
                <span>تم النسخ!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 text-slate-300" />
                <span>نسخ الرابط</span>
              </>
            )}
          </button>
        </div>

        {/* Step by Step Manual Guide for Android / iOS */}
        <div className="space-y-4 mb-6">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <Smartphone className="w-4 h-4 text-sky-400" />
            <span>خطوات التثبيت على الهاتف بالمتصفح:</span>
          </h3>

          {isIOS ? (
            /* iOS Safari Instructions */
            <div className="space-y-2.5 text-xs text-slate-300 bg-white/[0.03] p-4 rounded-2xl border border-white/[0.08]">
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-sky-500/20 text-sky-400 font-bold flex items-center justify-center shrink-0">1</div>
                <div className="flex items-center gap-1.5">
                  اضغط على زر المشاركة <Share2 className="w-4 h-4 text-sky-400 inline mx-1" /> في شريط متصفح Safari.
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-sky-500/20 text-sky-400 font-bold flex items-center justify-center shrink-0">2</div>
                <div>مرر لأسفل واختر <strong>"إضافة إلى الشاشة الرئيسية" (Add to Home Screen)</strong>.</div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-sky-500/20 text-sky-400 font-bold flex items-center justify-center shrink-0">3</div>
                <div>اضغط على <strong>"إضافة" (Add)</strong> بالأعلى لتثبيت التطبيق.</div>
              </div>
            </div>
          ) : (
            /* Android Instructions (Chrome, Samsung Internet, Edge, etc.) */
            <div className="space-y-3 text-xs text-slate-300 bg-white/[0.03] p-4 rounded-2xl border border-white/[0.08]">
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 font-bold flex items-center justify-center shrink-0">1</div>
                <div className="flex items-center gap-1">
                  افتح الرابط في متصفح الهاتف ثم اضغط على القائمة <MoreVertical className="w-4 h-4 text-indigo-400 inline" /> (الثلاث نقاط).
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 font-bold flex items-center justify-center shrink-0">2</div>
                <div>
                  اختر <strong>"تثبيت التطبيق" (Install App)</strong> أو <strong>"إضافة إلى الشاشة الرئيسية"</strong>.
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 font-bold flex items-center justify-center shrink-0">3</div>
                <div>
                  أكّد التثبيت، وسيظهر التطبيق بأيقونته الرسمية على شاشة هاتفك في درج التطبيقات مثل أي تطبيق أندرويد.
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Advantages of the Installed App */}
        <div className="bg-indigo-950/30 border border-indigo-500/20 rounded-2xl p-4 mb-6">
          <p className="text-xs font-bold text-indigo-300 mb-2.5 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-sky-400" />
            <span>مميزات تثبيت تطبيق الأندرويد:</span>
          </p>
          <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-300">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>فتح الملفات من الهاتف مباشرة</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>تشغيل كامل بدون أشرطة المتصفح</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>الحفاظ على الجلسة وحفظ المشاريع</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>أداء وسرعة مضاعفة مع كاش ذكي</span>
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-white/[0.08]">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-slate-300 text-xs font-bold transition-all cursor-pointer"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
