import React, { useState } from 'react';
import { 
  X, 
  CheckCircle2, 
  Download, 
  Copy, 
  Check, 
  ExternalLink, 
  FileArchive, 
  FileVideo, 
  FileCode2, 
  Award,
  Sparkles,
  Play,
  Share2
} from 'lucide-react';
import { DeliveryItem, Language } from '../types';
import { translations } from '../utils/translations';

interface DeliveryBoxModalProps {
  delivery: DeliveryItem | null;
  onClose: () => void;
  lang: Language;
  allDeliveries?: DeliveryItem[];
  onSelectDelivery?: (del: DeliveryItem) => void;
}

export const DeliveryBoxModal: React.FC<DeliveryBoxModalProps> = ({
  delivery,
  onClose,
  lang,
  allDeliveries = [],
  onSelectDelivery
}) => {
  const t = translations[lang];
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [activeDelivery, setActiveDelivery] = useState<DeliveryItem | null>(delivery);

  const current = activeDelivery || delivery;

  if (!current) return null;

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleCopyAll = () => {
    const summary = 
      `=== JIAWEI EFFECTS DELIVERY CERTIFICATE ===\n` +
      `Order: ${current.orderId}\n` +
      `Gift: ${current.giftTitle} (${current.giftId})\n` +
      `License Key: ${current.licenseKey}\n` +
      `License Type: ${current.licenseType}\n` +
      `Direct Video URL: ${current.videoUrl}\n` +
      `Package Download: ${current.downloadUrl}\n` +
      `Cloud Disk Code: ${current.cloudDiskCode || 'JW8866'}\n` +
      `==========================================`;
    navigator.clipboard.writeText(summary);
    setCopiedKey('all');
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const triggerDownload = (fileName: string, content: string) => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
      <div 
        className="relative w-full max-w-3xl rounded-2xl bg-[#0f131d] border border-cyan-500/40 shadow-2xl shadow-cyan-950/40 overflow-hidden my-auto max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with neon glow */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-gradient-to-r from-cyan-950/70 via-slate-900 to-blue-950/70">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <span>{t.deliveryTitle}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono border border-emerald-500/30">
                  {lang === 'ar' ? 'جاهز للاستلام' : '交付就绪'}
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                {t.deliverySub}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5">
          {/* Deliveries History Tabs (if multiple purchased) */}
          {allDeliveries.length > 1 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {allDeliveries.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveDelivery(item)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-colors border ${
                    item.id === current.id
                      ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {item.giftTitle} ({item.orderId})
                </button>
              ))}
            </div>
          )}

          {/* Certificate & Order Box */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-xl bg-gradient-to-br from-slate-900 to-[#141a29] border border-cyan-500/30">
            <div>
              <span className="text-[11px] text-slate-400 block">{t.orderNumber}</span>
              <span className="text-sm font-bold text-white font-mono">{current.orderId}</span>
              <span className="text-[11px] text-slate-400 block mt-2">{lang === 'ar' ? 'تاريخ الشراء والترخيص' : '订购时间'}</span>
              <span className="text-xs text-slate-300">{current.purchaseDate}</span>
            </div>

            <div>
              <span className="text-[11px] text-slate-400 block">{t.licenseCertNo}</span>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs font-bold text-cyan-300 font-mono truncate">{current.licenseKey}</span>
                <button
                  onClick={() => handleCopy(current.licenseKey, 'license')}
                  className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white"
                  title="Copy"
                >
                  {copiedKey === 'license' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
              <span className="text-[10px] text-amber-300/80 mt-1 block">
                {current.licenseType === 'exclusive' ? '★ 全网排他买断证书 (独占唯一)' : '✔ 正版商用授权证书 (已备案)'}
              </span>
            </div>
          </div>

          {/* Video Preview Box (Plays instantly from external direct URL - 0 server load!) */}
          <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col sm:flex-row items-center gap-4">
            <div className="w-24 h-32 rounded-lg bg-black overflow-hidden border border-slate-700 shrink-0 relative">
              <video
                src={current.videoUrl}
                autoPlay
                loop
                muted
                playsInline
                className="w-full h-full object-cover"
              />
              <div className="absolute bottom-1 right-1 px-1 rounded bg-black/60 text-[9px] text-cyan-300 font-mono">
                1080P
              </div>
            </div>

            <div className="flex-1 min-w-0 space-y-1 text-center sm:text-left">
              <h4 className="text-sm font-bold text-white">{current.giftTitle}</h4>
              <p className="text-xs text-slate-400">{current.format}</p>
              <div className="pt-2 flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <a
                  href={current.videoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 text-xs font-medium border border-cyan-500/30"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>{lang === 'ar' ? 'فتح رابط الفيديو المباشر' : '查看原画视频直链'}</span>
                </a>

                <button
                  onClick={() => handleCopy(current.videoUrl, 'videoUrl')}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700"
                >
                  {copiedKey === 'videoUrl' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{lang === 'ar' ? 'نسخ رابط الفيديو' : '复制视频链接'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Download Items List */}
          <div>
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2.5">
              {t.downloadAssets}
            </h4>

            <div className="space-y-2">
              {/* Asset 1: Complete Bundle Package */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
                    <FileArchive className="w-5 h-5" />
                  </div>
                  <div className="truncate">
                    <span className="text-xs font-bold text-white block truncate">
                      {current.giftTitle}_Full_VFX_Package.zip
                    </span>
                    <span className="text-[11px] text-slate-400">
                      SVGA + MP4带声 + VAP + PAG · {current.fileSize}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => triggerDownload(`${current.giftTitle}_Assets.txt`, `DOWNLOAD URL: ${current.downloadUrl}\nTOKEN: ${current.licenseKey}`)}
                    className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-cyan-500/20"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>{t.downloadDirect}</span>
                  </button>
                </div>
              </div>

              {/* Asset 2: Cloud Disk Extraction */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center shrink-0">
                    <ExternalLink className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-white block">
                      {t.externalDisk}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      百度网盘 / 阿里天翼高速通道 · {t.diskCode}: <strong className="text-amber-400 font-mono">{current.cloudDiskCode || 'JW8866'}</strong>
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => handleCopy(current.cloudDiskCode || 'JW8866', 'diskCode')}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1.5 border border-slate-700"
                >
                  {copiedKey === 'diskCode' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{t.copyDiskCode}</span>
                </button>
              </div>

              {/* Asset 3: Commercial License Certificate File */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                    <Award className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-white block">
                      正规商业授权证书 ({current.licenseKey}.pdf)
                    </span>
                    <span className="text-[11px] text-slate-400">
                      防侵权数字确权 · 平台官方盖章备案
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => triggerDownload(`Commercial_License_${current.licenseKey}.txt`, `JIAWEI COMMERCIAL LICENSE CERTIFICATE\nLicense Key: ${current.licenseKey}\nItem: ${current.giftTitle}\nScope: Live Streaming Commercial Use\nIssuer: Jiawei Effects Media Co.`)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1.5 border border-slate-700"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>下载证书</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-800 bg-slate-900/80 flex items-center justify-between gap-3">
          <button
            onClick={handleCopyAll}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition-colors"
          >
            {copiedKey === 'all' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5" />}
            <span>{t.copyAllLinks}</span>
          </button>

          <button
            onClick={onClose}
            className="px-6 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs font-bold shadow-md shadow-cyan-500/20 transition-colors"
          >
            {t.close}
          </button>
        </div>
      </div>
    </div>
  );
};
