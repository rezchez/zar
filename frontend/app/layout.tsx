import type { Metadata } from 'next';
import './globals.css';
import './document-form.css';
import '@/lib/uuid';
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

import { ToastProvider, Toaster } from '@/components/ui/toast';

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
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var m=localStorage.getItem('zarfolio-theme')||'system';var d=m==='dark'||(m==='system'&&window.matchMedia('(prefers-color-scheme:dark)').matches);var r=document.documentElement;if(d){r.classList.add('dark');r.setAttribute('data-theme','dark');r.style.colorScheme='dark';}else{r.classList.remove('dark');r.setAttribute('data-theme','light');r.style.colorScheme='light';}}catch(e){}})();`,
          }}
        />
        <meta name="color-scheme" content="dark light" />
        <meta name="theme-color" content={settings.pwaThemeColor || '#1e293b'} />
        {isPwaEnabled && <link rel="apple-touch-icon" href="/favicon.ico" />}
      </head>
      <body suppressHydrationWarning>
        <ThemeProvider>
          <SettingsProvider initialSettings={settings}>
            <ToastProvider>
              <Toaster position="bottom-right" progress />
              {children}
              <PwaInstallPrompt />
            </ToastProvider>
          </SettingsProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
