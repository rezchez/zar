'use client';

import { MorphIcon } from 'morphicons/react';
import { AlertTriangle, RefreshCw, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

// MorphIcon node shapes for normal vs active cache clear state
const REFRESH_NORMAL_NODES = [
  ['path', { d: 'M3 12a9 9 0 0 1 15-6.7L21 8' }],
  ['path', { d: 'M21 3v5h-5' }],
  ['path', { d: 'M21 12a9 9 0 0 1-15 6.7L3 16' }],
  ['path', { d: 'M3 21v-5h5' }],
] as const;

const REFRESH_ACTIVE_NODES = [
  ['path', { d: 'M12 2v4' }],
  ['path', { d: 'M12 18v4' }],
  ['path', { d: 'M4.93 4.93l2.83 2.83' }],
  ['path', { d: 'M16.24 16.24l2.83 2.83' }],
] as const;

export default function CacheRebuildButton({
  collapsed: _collapsed = false,
}: {
  collapsed?: boolean;
}) {
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Close on Escape key press
  useEffect(() => {
    if (!showConfirmModal || loading) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowConfirmModal(false);
        setErrorMsg('');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showConfirmModal, loading]);

  async function handleRebuildCache() {
    setLoading(true);
    setErrorMsg('');

    try {
      const response = await fetch('/api/admin/cache/rebuild', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        const errorData = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(errorData.error || 'خطا در بازسازی کش سرور');
      }

      // Clear Service Worker and Browser Caches if available
      if ('caches' in window) {
        try {
          const cacheKeys = await window.caches.keys();
          await Promise.all(cacheKeys.map((key) => window.caches.delete(key)));
        } catch {
          // Ignore cache deletion errors
        }
      }

      if ('serviceWorker' in navigator) {
        try {
          const registrations = await navigator.serviceWorker.getRegistrations();
          await Promise.all(registrations.map((reg) => reg.unregister()));
        } catch {
          // Ignore service worker unregister errors
        }
      }

      // Set session flag to prevent reload loops
      try {
        window.sessionStorage.setItem('zar_cache_rebuilt', String(Date.now()));
      } catch {
        // SessionStorage fallback
      }

      // Perform hard reload
      window.location.href = window.location.href;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'خطای غیرمنتظره در پاکسازی کش';
      setErrorMsg(msg);
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setShowConfirmModal(true)}
        disabled={loading}
        title="پاکسازی کش"
        aria-label="پاکسازی کش"
        className="group relative inline-flex size-7 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 p-1 text-slate-500 hover:border-amber-400 hover:bg-amber-50 hover:text-amber-700 dark:border-slate-800 dark:bg-slate-800/80 dark:text-slate-400 dark:hover:border-amber-500/50 dark:hover:bg-amber-950/40 dark:hover:text-amber-300 transition-all duration-150"
      >
        <MorphIcon
          icon={loading ? REFRESH_ACTIVE_NODES : REFRESH_NORMAL_NODES}
          spring="smooth"
          reducedMotion="user"
          size={14}
          strokeWidth={2}
          className={loading ? 'animate-spin text-amber-600' : ''}
        />
      </button>

      {showConfirmModal &&
        mounted &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-150"
            role="dialog"
            aria-modal="true"
            onClick={(e) => {
              if (e.target === e.currentTarget && !loading) {
                setShowConfirmModal(false);
                setErrorMsg('');
              }
            }}
          >
            <div className="confirm-dialog relative w-full max-w-md rounded-2xl border border-slate-200/80 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 p-6 shadow-2xl backdrop-blur-xl animate-in zoom-in-95 duration-150 text-right">
              <button
                type="button"
                className="confirm-close absolute top-4 left-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                onClick={() => {
                  if (!loading) {
                    setShowConfirmModal(false);
                    setErrorMsg('');
                  }
                }}
                aria-label="انصراف"
                disabled={loading}
              >
                <X size={18} />
              </button>

              <div className="confirm-icon mb-3">
                <AlertTriangle size={24} className="text-amber-600" />
              </div>

              <h2 className="text-base font-black text-slate-900 dark:text-white">
                بازسازی کامل کش برنامه
              </h2>

              <p className="font-bold text-slate-800 dark:text-slate-100 mt-2 text-sm">
                آیا می‌خواهید کش برنامه به‌طور کامل بازسازی شود؟
              </p>

              <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                این عملیات کش سرور و داده‌های موقت برنامه را پاکسازی کرده، سرویس Next.js را یک‌بار بازنشانی می‌کند و مرورگر را با Hard Reload مجدداً بارگذاری خواهد کرد.
              </p>

              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300 flex items-start gap-2">
                <AlertTriangle size={15} className="shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                <span>این عملیات ممکن است باعث شود برنامه برای چند لحظه از دسترس خارج شود.</span>
              </div>

              {errorMsg && (
                <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-xs font-bold text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300">
                  {errorMsg}
                </div>
              )}

              <div className="confirm-actions mt-5 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  className="dashboard-secondary-button text-xs py-2 px-3.5"
                  onClick={() => {
                    setShowConfirmModal(false);
                    setErrorMsg('');
                  }}
                  disabled={loading}
                >
                  انصراف
                </button>

                <button
                  type="button"
                  className="account-danger-solid-button text-xs py-2 px-4 flex items-center gap-1.5"
                  onClick={handleRebuildCache}
                  disabled={loading}
                >
                  {loading && <RefreshCw size={14} className="animate-spin" />}
                  <span>{loading ? 'در حال بازسازی...' : 'بله، بازسازی کش'}</span>
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
