import 'server-only';
import { createPocketBaseClient } from '@/lib/pocketbase';
import { defaultSettings, normalizeSettings, type AppSettings } from '@/lib/settings';

/**
 * Fetches application settings securely on the server without requiring user authentication cookies.
 * Falls back to defaultSettings if PocketBase is unreachable or empty.
 */
export async function getServerAppSettings(): Promise<AppSettings> {
  try {
    const pb = createPocketBaseClient();
    const record = await pb.collection('app_settings').getFirstListItem('id != ""').catch(() => null);
    if (record) {
      return normalizeSettings(record as Record<string, unknown>);
    }
  } catch {
    // Graceful fallback to defaults
  }
  return defaultSettings;
}
