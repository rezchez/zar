'use client';

import React, { useEffect, useState } from 'react';
import { DownloadCloud, X } from 'lucide-react';
import { useAppSettings } from './SettingsProvider';
import {
  isIosDevice,
  isStandaloneMode,
  isServiceWorkerSupported,
  registerPwaServiceWorker,
  unregisterPwaServiceWorker,
  clearPwaCaches,
  PWA_DISMISSED_KEY,
} from '@/lib/pwa';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export default function PwaInstallPrompt() {
  const { settings, isLoading } = useAppSettings();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  const isPwaEnabled = settings.pwaEnabled;

  useEffect(() => {
    let isCancelled = false;

    if (!isServiceWorkerSupported()) return;

    if (!isPwaEnabled) {
      // PWA is disabled: cleanly unregister Service Worker and clear PWA cache
      setShowPrompt(false);
      setDeferredPrompt(null);
      void unregisterPwaServiceWorker();
      void clearPwaCaches();
      return;
    }

    // PWA is enabled: register Service Worker
    void registerPwaServiceWorker('/sw.js');

    // Check if running in standalone mode (already installed)
    if (isStandaloneMode()) {
      setIsStandalone(true);
      return;
    }

    // Detect iOS since it does not support beforeinstallprompt
    if (isIosDevice()) {
      setIsIOS(true);
      const dismissedTime = localStorage.getItem(PWA_DISMISSED_KEY);
      if (!dismissedTime || Date.now() - parseInt(dismissedTime, 10) > 7 * 24 * 60 * 60 * 1000) {
        if (!isCancelled) setShowPrompt(true);
      }
      return;
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      if (!isPwaEnabled || isCancelled) return;

      setDeferredPrompt(e as BeforeInstallPromptEvent);

      const dismissedTime = localStorage.getItem(PWA_DISMISSED_KEY);
      // Wait 7 days before prompting again if previously dismissed
      if (!dismissedTime || Date.now() - parseInt(dismissedTime, 10) > 7 * 24 * 60 * 60 * 1000) {
        setShowPrompt(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => {
      isCancelled = true;
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, [isPwaEnabled]);

  const handleInstallClick = async () => {
    if (isIOS) {
      handleDismiss();
      return;
    }

    if (!deferredPrompt) return;

    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      console.log('User accepted the PWA prompt');
    } else {
      console.log('User dismissed the PWA prompt');
    }

    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    try {
      localStorage.setItem(PWA_DISMISSED_KEY, Date.now().toString());
    } catch {
      // ignore storage errors
    }
  };

  if (isLoading || !isPwaEnabled || !showPrompt || isStandalone) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:right-auto md:w-96 z-[9999] bg-slate-900 text-white rounded-2xl p-4 shadow-2xl flex items-start gap-4 border border-slate-700 animate-in slide-in-from-bottom-5">
      <div className="bg-amber-500/20 text-amber-500 p-2 rounded-xl shrink-0">
        <DownloadCloud size={24} />
      </div>
      <div className="flex-1 space-y-2">
        <h3 className="font-bold text-sm">نصب وب‌اپلیکیشن {settings.pwaAppName || 'زر فولیـو'}</h3>
        <p className="text-xs text-slate-300 leading-relaxed">
          {isIOS
            ? 'برای تجربه کاربری بهتر، در مرورگر سافاری دکمه Share را بزنید و "Add to Home Screen" را انتخاب کنید.'
            : 'برای دسترسی سریع‌تر و تجربه یکپارچه‌تر، اپلیکیشن را روی دستگاه خود نصب کنید.'}
        </p>
        <div className="flex items-center gap-2 pt-2">
          {!isIOS && (
            <button
              type="button"
              onClick={handleInstallClick}
              className="bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs px-4 py-2 rounded-lg transition-colors cursor-pointer"
            >
              نصب سریع
            </button>
          )}
          <button
            type="button"
            onClick={handleDismiss}
            className="text-slate-400 hover:text-white text-xs px-3 py-2 transition-colors cursor-pointer"
          >
            بعداً
          </button>
        </div>
      </div>
      <button
        type="button"
        onClick={handleDismiss}
        className="text-slate-400 hover:text-white shrink-0 p-1 cursor-pointer"
        aria-label="بستن اعلان"
      >
        <X size={16} />
      </button>
    </div>
  );
}
