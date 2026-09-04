'use client';

import { MorphIcon } from 'morphicons/react';
import { AlertTriangle, RefreshCw, X } from 'lucide-react';
import { useState } from 'react';

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
  collapsed = false,
}: {
  collapsed?: boolean;
}) {
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

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
        className={`group relative inline-flex items-center justify-center rounded-lg border border-slate-200 bg-slate-50 p-1.5 text-slate-500 hover:border-amber-400 hover:bg-amber-50 hover:text-amber-700 dark:border-slate-800 dark:bg-slate-800/80 dark:text-slate-400 dark:hover:border-amber-500/50 dark:hover:bg-amber-950/40 dark:hover:text-amber-300 transition-all duration-150 ${
          collapsed ? 'size-7' : 'px-2 py-1 gap-1 text-[10px] font-extrabold'
        }`}
      >
        <MorphIcon
          icon={loading ? REFRESH_ACTIVE_NODES : REFRESH_NORMAL_NODES}
          spring="smooth"
          reducedMotion="user"
          size={13}
          strokeWidth={2}
          className={loading ? 'animate-spin text-amber-600' : ''}
        />
        {!collapsed && <span>پاکسازی کش</span>}
      </button>

      {showConfirmModal && (
        <div className="confirm-backdrop" role="dialog" aria-modal="true">
          <div className="confirm-dialog">
            <button
              type="button"
              className="confirm-close"
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

            <div className="confirm-icon">
              <AlertTriangle size={24} />
            </div>

            <h2>بازسازی کامل کش برنامه</h2>

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

            <div className="confirm-actions mt-5">
              <button
                type="button"
                className="dashboard-secondary-button"
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
                className="account-danger-solid-button flex items-center gap-1.5"
                onClick={handleRebuildCache}
                disabled={loading}
              >
                {loading && <RefreshCw size={14} className="animate-spin" />}
                <span>{loading ? 'در حال بازسازی...' : 'بله، بازسازی کش'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
