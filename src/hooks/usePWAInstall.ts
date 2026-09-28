import { useEffect, useState, useCallback } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState<boolean>(false);
  const [isAndroid, setIsAndroid] = useState<boolean>(false);
  const [isIOS, setIsIOS] = useState<boolean>(false);
  const [canInstallDirectly, setCanInstallDirectly] = useState<boolean>(false);

  useEffect(() => {
    // 1. Detect standalone mode (already installed or running as PWA)
    const checkStandalone = () => {
      const isStandaloneMedia = window.matchMedia('(display-mode: standalone)').matches;
      const isIOSStandalone = (window.navigator as any).standalone === true;
      const isAndroidApp = document.referrer.includes('android-app://') || window.location.search.includes('standalone=true');
      return isStandaloneMedia || isIOSStandalone || isAndroidApp;
    };

    setIsInstalled(checkStandalone());

    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const handleDisplayModeChange = (e: MediaQueryListEvent) => {
      setIsInstalled(e.matches);
    };
    try {
      mediaQuery.addEventListener('change', handleDisplayModeChange);
    } catch {
      mediaQuery.addListener(handleDisplayModeChange);
    }

    // 2. Detect platform
    const ua = (navigator.userAgent || '').toLowerCase();
    const isAndroidDevice = /android/.test(ua);
    const isIOSDevice = /iphone|ipad|ipod/.test(ua);
    setIsAndroid(isAndroidDevice);
    setIsIOS(isIOSDevice);

    // 3. Listen to beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent browser default mini-infobar
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setCanInstallDirectly(true);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setCanInstallDirectly(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      try {
        mediaQuery.removeEventListener('change', handleDisplayModeChange);
      } catch {
        mediaQuery.removeListener(handleDisplayModeChange);
      }
    };
  }, []);

  const triggerInstall = useCallback(async (): Promise<{ success: boolean; manualNeeded: boolean }> => {
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === 'accepted') {
          setIsInstalled(true);
          setDeferredPrompt(null);
          setCanInstallDirectly(false);
          return { success: true, manualNeeded: false };
        } else {
          return { success: false, manualNeeded: false };
        }
      } catch (err) {
        console.error('[PWA] Prompt error:', err);
        return { success: false, manualNeeded: true };
      }
    }
    // If prompt is not natively available (e.g. Firefox, Samsung browser before trigger, Safari, or already installed)
    return { success: false, manualNeeded: true };
  }, [deferredPrompt]);

  return {
    isInstallable: canInstallDirectly || !isInstalled,
    canInstallDirectly,
    isInstalled,
    isAndroid,
    isIOS,
    triggerInstall,
  };
}
