import { MetadataRoute } from 'next';

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || '';

  // Try to fetch settings, fallback to defaults
  let appName = 'Zarfolio';
  let shortName = 'Zarfolio';
  let themeColor = '#1e293b';
  let backgroundColor = '#ffffff';
  let displayMode: 'fullscreen' | 'standalone' | 'minimal-ui' | 'browser' = 'standalone';

  try {
    const res = await fetch(`${baseUrl}/api/settings`, { cache: 'no-store' }).catch(() => null);
    if (res && res.ok) {
      const data = await res.json();
      if (data && data.settings) {
        appName = data.settings.pwaAppName || data.settings.organizationName || 'Zarfolio';
        shortName = data.settings.pwaShortName || 'Zarfolio';
        themeColor = data.settings.pwaThemeColor || '#1e293b';
        backgroundColor = data.settings.pwaBackgroundColor || '#ffffff';
        displayMode = data.settings.pwaDisplayMode || 'standalone';
      }
    }
  } catch (error) {
    // silently fallback
  }

  return {
    name: appName,
    short_name: shortName,
    description: 'Zarfolio application',
    start_url: '/',
    display: displayMode,
    background_color: backgroundColor,
    theme_color: themeColor,
    icons: [
      {
        src: '/favicon.ico',
        sizes: 'any',
        type: 'image/x-icon',
      },
    ],
  };
}
