import 'server-only';
import { cache } from 'react';
import { createPocketBaseClient } from '@/lib/pocketbase';
import { defaultSettings, normalizeSettings, type AppSettings } from '@/lib/settings';

let cachedSettings: { data: AppSettings; timestamp: number } | null = null;
const SETTINGS_CACHE_TTL_MS = 15_000;

/**
 * Invalidate cached server settings when settings are updated.
 */
export function invalidateServerAppSettingsCache(): void {
  cachedSettings = null;
}

/**
 * Fetches application settings securely on the server without requiring user authentication cookies.
 * Falls back to defaultSettings if PocketBase is unreachable or empty.
 * Deduplicated per-request via React cache() and cached in-memory for 15 seconds.
 */
export const getServerAppSettings = cache(async function getServerAppSettings(): Promise<AppSettings> {
  const now = Date.now();
  if (cachedSettings && now - cachedSettings.timestamp < SETTINGS_CACHE_TTL_MS) {
    return cachedSettings.data;
  }

  try {
    const pb = createPocketBaseClient();
    const record = await pb.collection('app_settings').getFirstListItem('id != ""', {
      signal: AbortSignal.timeout(2000),
    }).catch(() => null);

    if (record) {
      const normalized = normalizeSettings(record as Record<string, unknown>);
      cachedSettings = { data: normalized, timestamp: now };
      return normalized;
    }
  } catch {
    // Graceful fallback to cached settings or defaults
  }

  if (cachedSettings) {
    return cachedSettings.data;
  }

  return defaultSettings;
});

