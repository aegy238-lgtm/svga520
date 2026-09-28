import React, { useState } from 'react';
import { Smartphone, Download, CheckCircle2, Sparkles } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { PWAInstallModal } from './PWAInstallModal';

interface PWAFloatingInstallButtonProps {
  className?: string;
}

export const PWAFloatingInstallButton: React.FC<PWAFloatingInstallButtonProps> = ({ className = '' }) => {
  const {
    isInstallable,
    canInstallDirectly,
    isInstalled,
    isAndroid,
    isIOS,
    triggerInstall
  } = usePWAInstall();

  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleClick = async () => {
    // 1. If native direct install prompt is ready, trigger it first
    if (canInstallDirectly && !isInstalled) {
      const { success, manualNeeded } = await triggerInstall();
      if (!success || manualNeeded) {
        setIsModalOpen(true);
      }
    } else {
      // 2. Open the comprehensive system install modal
      setIsModalOpen(true);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-xl transition-all duration-300 hover:scale-110 active:scale-95 group cursor-pointer relative ${
          isInstalled
            ? 'bg-[#0e172a] hover:bg-[#1e293b] text-emerald-400 border border-emerald-500/40 shadow-emerald-500/10'
            : 'bg-gradient-to-tr from-indigo-600 via-sky-600 to-indigo-500 hover:from-indigo-500 hover:to-sky-400 text-white border border-indigo-300/40 shadow-indigo-600/30'
        } ${className}`}
        title={isInstalled ? 'تطبيق الأندرويد مثبت - انقر لعرض تفاصيل النظام' : 'تثبيت التطبيق على هاتفك (Android PWA App)'}
        aria-label="تثبيت التطبيق على الهاتف"
      >
        {/* Subtle Ambient Pulse Ring if not installed */}
        {!isInstalled && (
          <span className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-sky-500 to-indigo-600 opacity-40 blur-sm group-hover:opacity-75 transition duration-500 animate-pulse pointer-events-none" />
        )}

        {/* Status Badge Indicator */}
        <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center">
          {isInstalled ? (
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-[#0a0f1d]" />
          ) : (
            <>
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-sky-300" />
            </>
          )}
        </span>

        {/* Icon */}
        <div className="relative z-10 flex items-center justify-center">
          {isInstalled ? (
            <CheckCircle2 className="w-6 h-6 text-emerald-400" />
          ) : (
            <div className="relative">
              <Smartphone className="w-6 h-6 text-white group-hover:scale-105 transition-transform" />
              <Download className="w-2.5 h-2.5 text-sky-200 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-bounce" />
            </div>
          )}
        </div>
      </button>

      {/* Full Screen / Pop-up System Installation Modal */}
      <PWAInstallModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        isAndroid={isAndroid}
        isIOS={isIOS}
        canInstallDirectly={canInstallDirectly}
        onDirectInstall={() => triggerInstall()}
        isInstalled={isInstalled}
      />
    </>
  );
};
