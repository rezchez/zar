import type { Metadata } from 'next'
import Script from 'next/script'
import './globals.css'
import './document-form.css'
import ThemeProvider from '@/src/components/ThemeProvider'
import { SettingsProvider } from '@/src/components/SettingsProvider'
import PwaInstallPrompt from '@/src/components/PwaInstallPrompt'

export const metadata: Metadata = {
  title: 'Zarfolio',
  description: 'Zarfolio workspace',
}

const themeBootstrap = `
(() => {
  try {
    const stored = localStorage.getItem('zarfolio-theme');
    const mode = (stored === 'light' || stored === 'dark' || stored === 'system')
      ? stored
      : 'system';

    const theme = mode === 'system'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : mode;

    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.themeMode = mode;
    document.documentElement.style.colorScheme = theme;

    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  } catch {
    const theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.themeMode = 'system';
    document.documentElement.style.colorScheme = theme;

    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }
})()
`

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <head>
        <meta name="color-scheme" content="dark light" />
        <meta name="theme-color" content="#1e293b" />
        <link rel="apple-touch-icon" href="/favicon.ico" />
        <Script
          id="zarfolio-theme-bootstrap"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: themeBootstrap }}
        />
        <Script id="register-sw" strategy="afterInteractive">
          {`
            if ('serviceWorker' in navigator) {
              window.addEventListener('load', function() {
                navigator.serviceWorker.register('/sw.js').then(
                  function(registration) {
                    console.log('Service Worker registration successful with scope: ', registration.scope);
                  },
                  function(err) {
                    console.log('Service Worker registration failed: ', err);
                  }
                );
              });
            }
          `}
        </Script>
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
  )
}
