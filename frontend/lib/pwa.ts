/**
 * PWA & Service Worker Lifecycle Utilities
 *
 * Provides safe client-side management of Service Worker registration,
 * unregistration, and PWA cache cleanup without risking non-PWA data.
 */

export const PWA_CACHE_PREFIX = 'zarfolio-pwa-cache';
export const PWA_DISMISSED_KEY = 'zarfolio-pwa-dismissed';

/**
 * Checks if Service Worker API is supported in the current environment.
 */
export function isServiceWorkerSupported(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator;
}

/**
 * Registers the PWA Service Worker.
 */
export async function registerPwaServiceWorker(swUrl = '/sw.js'): Promise<ServiceWorkerRegistration | null> {
  if (!isServiceWorkerSupported()) return null;

  try {
    const registration = await navigator.serviceWorker.register(swUrl, { scope: '/' });
    return registration;
  } catch (error) {
    console.error('Failed to register PWA Service Worker:', error);
    return null;
  }
}

/**
 * Unregisters all Service Workers associated with the current origin/scope.
 */
export async function unregisterPwaServiceWorker(): Promise<boolean> {
  if (!isServiceWorkerSupported()) return false;

  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    const results = await Promise.all(registrations.map((reg) => reg.unregister()));
    return results.every(Boolean);
  } catch (error) {
    console.error('Failed to unregister PWA Service Worker:', error);
    return false;
  }
}

/**
 * Clears PWA-specific Cache Storage caches (matching PWA_CACHE_PREFIX or related PWA assets)
 * while preserving unrelated caches or non-PWA application storage.
 */
export async function clearPwaCaches(): Promise<boolean> {
  if (typeof window === 'undefined' || !('caches' in window)) return false;

  try {
    const cacheNames = await window.caches.keys();
    const pwaCacheNames = cacheNames.filter((name) => name.startsWith(PWA_CACHE_PREFIX) || name.includes('zarfolio-pwa'));

    const deletions = await Promise.all(
      pwaCacheNames.map((name) => window.caches.delete(name)),
    );
    return deletions.every(Boolean);
  } catch (error) {
    console.error('Failed to clear PWA caches:', error);
    return false;
  }
}

/**
 * Detects whether the app is currently running as an installed standalone PWA.
 */
export function isStandaloneMode(): boolean {
  if (typeof window === 'undefined') return false;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return window.matchMedia('(display-mode: standalone)').matches || ('standalone' in navigator && (navigator as any).standalone === true);
}

/**
 * Detects if the client device is iOS (Safari/WebKit).
 */
export function isIosDevice(): boolean {
  if (typeof window === 'undefined') return false;

  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}
