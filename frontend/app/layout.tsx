import type { Metadata } from 'next';
import './globals.css';
import './document-form.css';
import ThemeProvider from '@/src/components/ThemeProvider';
import { SettingsProvider } from '@/src/components/SettingsProvider';
import PwaInstallPrompt from '@/src/components/PwaInstallPrompt';
import { getServerAppSettings } from '@/lib/server-settings';

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getServerAppSettings();
  const isPwaEnabled = settings.pwaEnabled;

  return {
    title: settings.organizationName || 'Zarfolio',
    description: 'Zarfolio workspace',
    manifest: isPwaEnabled ? '/manifest.webmanifest' : undefined,
    appleWebApp: isPwaEnabled
      ? {
          capable: true,
          statusBarStyle: 'default',
          title: settings.pwaShortName || 'Zarfolio',
        }
      : false,
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const settings = await getServerAppSettings();
  const isPwaEnabled = settings.pwaEnabled;

  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <head>
        <meta name="color-scheme" content="dark light" />
        <meta name="theme-color" content={settings.pwaThemeColor || '#1e293b'} />
        {isPwaEnabled && <link rel="apple-touch-icon" href="/favicon.ico" />}
      </head>
      <body suppressHydrationWarning>
        <ThemeProvider>
          <SettingsProvider>
            {children}
            <PwaInstallPrompt />
          </SettingsProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
