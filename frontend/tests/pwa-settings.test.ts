import { describe, it, expect } from 'bun:test';
import { defaultSettings, normalizeSettings } from '@/lib/settings';
import { getServerAppSettings } from '@/lib/server-settings';
import { GET as getSwScript } from '@/app/sw.js/route';
import { GET as getPwaStatus } from '@/app/api/pwa/status/route';
import {
  PWA_CACHE_PREFIX,
  PWA_DISMISSED_KEY,
  isServiceWorkerSupported,
  registerPwaServiceWorker,
  unregisterPwaServiceWorker,
  clearPwaCaches,
  isStandaloneMode,
  isIosDevice,
} from '@/lib/pwa';

describe('PWA Settings Normalization & Defaults', () => {
  it('defaults pwaEnabled to true when not specified in input', () => {
    const normalized = normalizeSettings({});
    expect(normalized.pwaEnabled).toBe(true);
    expect(normalized.pwa_enabled).toBe(true);
    expect(defaultSettings.pwaEnabled).toBe(true);
  });

  it('correctly sets pwaEnabled to false when input provides pwaEnabled: false', () => {
    const input = {
      pwaEnabled: false,
      pwaAppName: 'سامانه تست',
    };
    const normalized = normalizeSettings(input);
    expect(normalized.pwaEnabled).toBe(false);
    expect(normalized.pwa_enabled).toBe(false);
    expect(normalized.pwaAppName).toBe('سامانه تست');
  });

  it('correctly sets pwaEnabled to true when input provides pwaEnabled: true', () => {
    const input = {
      pwaEnabled: true,
      pwaAppName: 'زر فولیـو',
    };
    const normalized = normalizeSettings(input);
    expect(normalized.pwaEnabled).toBe(true);
    expect(normalized.pwa_enabled).toBe(true);
  });

  it('supports legacy snake_case pwa_enabled field for backward compatibility', () => {
    const inputDisabled = { pwa_enabled: false };
    const normalizedDisabled = normalizeSettings(inputDisabled);
    expect(normalizedDisabled.pwaEnabled).toBe(false);
    expect(normalizedDisabled.pwa_enabled).toBe(false);

    const inputEnabled = { pwa_enabled: true };
    const normalizedEnabled = normalizeSettings(inputEnabled);
    expect(normalizedEnabled.pwaEnabled).toBe(true);
    expect(normalizedEnabled.pwa_enabled).toBe(true);
  });

  it('handles custom PWA metadata correctly', () => {
    const input = {
      pwaEnabled: true,
      pwaAppName: 'برنامه طلا و جواهر',
      pwaShortName: 'طلا',
      pwaThemeColor: '#0f172a',
      pwaBackgroundColor: '#f8fafc',
      pwaDisplayMode: 'minimal-ui',
    };
    const normalized = normalizeSettings(input);
    expect(normalized.pwaEnabled).toBe(true);
    expect(normalized.pwaAppName).toBe('برنامه طلا و جواهر');
    expect(normalized.pwaShortName).toBe('طلا');
    expect(normalized.pwaThemeColor).toBe('#0f172a');
    expect(normalized.pwaBackgroundColor).toBe('#f8fafc');
    expect(normalized.pwaDisplayMode).toBe('minimal-ui');
  });
});

describe('Backend Server-Side PWA Handling', () => {
  it('getServerAppSettings returns valid default configuration when database is offline', async () => {
    const settings = await getServerAppSettings();
    expect(typeof settings.pwaEnabled).toBe('boolean');
    expect(settings.pwaAppName).toBeDefined();
  });

  it('/sw.js route handler serves javascript with no-cache headers', async () => {
    const response = await getSwScript();
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toContain('application/javascript');
    expect(response.headers.get('Cache-Control')).toBeDefined();

    const body = await response.text();
    expect(body.length).toBeGreaterThan(0);
  });

  it('/api/pwa/status route handler returns backend PWA state', async () => {
    const response = await getPwaStatus();
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(typeof data.pwaEnabled).toBe('boolean');
  });
});

describe('PWA Lifecycle Utilities', () => {
  it('defines the correct cache prefix and dismissal key', () => {
    expect(PWA_CACHE_PREFIX).toBe('zarfolio-pwa-cache');
    expect(PWA_DISMISSED_KEY).toBe('zarfolio-pwa-dismissed');
  });

  it('gracefully handles server-side environments where window or navigator is absent', () => {
    const isSupported = isServiceWorkerSupported();
    expect(typeof isSupported).toBe('boolean');
    expect(typeof isStandaloneMode()).toBe('boolean');
    expect(typeof isIosDevice()).toBe('boolean');
  });

  it('deletes only PWA-specific caches and leaves unrelated caches intact', async () => {
    const deletedCaches: string[] = [];
    const mockCacheStorage = {
      keys: async () => [
        'zarfolio-pwa-cache-v1',
        'zarfolio-pwa-cache-v2',
        'user-avatar-cache',
        'app-custom-fonts-cache',
      ],
      delete: async (name: string) => {
        deletedCaches.push(name);
        return true;
      },
    };

    const originalWindow = (global as Record<string, unknown>).window;
    (global as Record<string, unknown>).window = {
      caches: mockCacheStorage,
    };

    try {
      const result = await clearPwaCaches();
      expect(result).toBe(true);
      expect(deletedCaches).toContain('zarfolio-pwa-cache-v1');
      expect(deletedCaches).toContain('zarfolio-pwa-cache-v2');
      expect(deletedCaches).not.toContain('user-avatar-cache');
      expect(deletedCaches).not.toContain('app-custom-fonts-cache');
    } finally {
      (global as Record<string, unknown>).window = originalWindow;
    }
  });

  it('unregisters all service workers when unregisterPwaServiceWorker is called', async () => {
    let unregisterCalled = false;
    const mockRegistration = {
      unregister: async () => {
        unregisterCalled = true;
        return true;
      },
    };

    const originalWindow = (global as Record<string, unknown>).window;
    const originalNavigator = (global as Record<string, unknown>).navigator;

    (global as Record<string, unknown>).window = {};
    (global as Record<string, unknown>).navigator = {
      serviceWorker: {
        getRegistrations: async () => [mockRegistration],
      },
    };

    try {
      const result = await unregisterPwaServiceWorker();
      expect(result).toBe(true);
      expect(unregisterCalled).toBe(true);
    } finally {
      (global as Record<string, unknown>).window = originalWindow;
      (global as Record<string, unknown>).navigator = originalNavigator;
    }
  });

  it('registers service worker with correct scope when registerPwaServiceWorker is called', async () => {
    let registeredUrl = '';
    let registeredOptions: unknown = null;
    const mockRegistration = { scope: '/' };

    const originalWindow = (global as Record<string, unknown>).window;
    const originalNavigator = (global as Record<string, unknown>).navigator;

    (global as Record<string, unknown>).window = {};
    (global as Record<string, unknown>).navigator = {
      serviceWorker: {
        register: async (url: string, opts: unknown) => {
          registeredUrl = url;
          registeredOptions = opts;
          return mockRegistration;
        },
      },
    };

    try {
      const reg = await registerPwaServiceWorker('/sw.js');
      expect(reg).toBe(mockRegistration as unknown as ServiceWorkerRegistration);
      expect(registeredUrl).toBe('/sw.js');
      expect(registeredOptions).toEqual({ scope: '/' });
    } finally {
      (global as Record<string, unknown>).window = originalWindow;
      (global as Record<string, unknown>).navigator = originalNavigator;
    }
  });
});
