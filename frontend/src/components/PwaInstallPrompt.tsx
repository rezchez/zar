'use client';

import React, { useEffect, useState } from 'react';
import { DownloadCloud, X } from 'lucide-react';

const PWA_DISMISSED_KEY = 'zarfolio-pwa-dismissed';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export default function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Check if running in standalone mode (already installed)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const checkStandalone = window.matchMedia('(display-mode: standalone)').matches
      || ('standalone' in navigator && (navigator as any).standalone === true);

    if (checkStandalone) {
      // setIsStandalone(true);
      return;
    }

    // Detect iOS since it does not support beforeinstallprompt
    const isIosDevice =
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

    if (isIosDevice) {
      // setIsIOS(true);
      const dismissedTime = localStorage.getItem(PWA_DISMISSED_KEY);
      if (!dismissedTime || Date.now() - parseInt(dismissedTime, 10) > 7 * 24 * 60 * 60 * 1000) {
        // setShowPrompt(true); // Show iOS instruction prompt if not dismissed recently (e.g. 7 days)
      }
      return;
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);

      const dismissedTime = localStorage.getItem(PWA_DISMISSED_KEY);
      // Wait 7 days before nagging again if previously dismissed
      if (!dismissedTime || Date.now() - parseInt(dismissedTime, 10) > 7 * 24 * 60 * 60 * 1000) {
        setShowPrompt(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstallClick = async () => {
    if (isIOS) {
      // Just close it on iOS after they theoretically read the instructions
      handleDismiss();
      return;
    }

    if (!deferredPrompt) return;

    deferredPrompt.prompt();
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
    localStorage.setItem(PWA_DISMISSED_KEY, Date.now().toString());
  };

  if (!showPrompt || isStandalone) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:right-auto md:w-96 z-[9999] bg-slate-900 text-white rounded-2xl p-4 shadow-2xl flex items-start gap-4 border border-slate-700 animate-in slide-in-from-bottom-5">
      <div className="bg-amber-500/20 text-amber-500 p-2 rounded-xl shrink-0">
        <DownloadCloud size={24} />
      </div>
      <div className="flex-1 space-y-2">
        <h3 className="font-bold text-sm">نصب وب‌اپلیکیشن زر فولیـو</h3>
        <p className="text-xs text-slate-300 leading-relaxed">
          {isIOS
            ? 'برای تجربه کاربری بهتر، در مرورگر سافاری دکمه Share را بزنید و "Add to Home Screen" را انتخاب کنید.'
            : 'برای دسترسی سریع‌تر و تجربه یکپارچه‌تر، اپلیکیشن را روی دستگاه خود نصب کنید.'}
        </p>
        <div className="flex items-center gap-2 pt-2">
          {!isIOS && (
            <button
              onClick={handleInstallClick}
              className="bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs px-4 py-2 rounded-lg transition-colors"
            >
              نصب سریع
            </button>
          )}
          <button
            onClick={handleDismiss}
            className="text-slate-400 hover:text-white text-xs px-3 py-2 transition-colors"
          >
            بعداً
          </button>
        </div>
      </div>
      <button onClick={handleDismiss} className="text-slate-400 hover:text-white shrink-0 p-1">
        <X size={16} />
      </button>
    </div>
  );
}
