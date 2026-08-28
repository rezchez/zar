import { MetadataRoute } from 'next';
import { getServerAppSettings } from '@/lib/server-settings';

export const dynamic = 'force-dynamic';

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const settings = await getServerAppSettings();
  const isEnabled = settings.pwaEnabled;

  return {
    name: settings.pwaAppName || settings.organizationName || 'Zarfolio',
    short_name: settings.pwaShortName || 'Zarfolio',
    description: 'Zarfolio application',
    start_url: '/',
    display: isEnabled ? settings.pwaDisplayMode : 'browser',
    background_color: settings.pwaBackgroundColor,
    theme_color: settings.pwaThemeColor,
    icons: isEnabled
      ? [
          {
            src: '/favicon.ico',
            sizes: 'any',
            type: 'image/x-icon',
          },
        ]
      : [],
  };
}
