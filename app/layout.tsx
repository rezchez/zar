import type { Metadata } from 'next'
import Script from 'next/script'
import './globals.css'
import './document-form.css'
import ThemeProvider from '@/src/components/ThemeProvider'

export const metadata: Metadata = {
  title: 'Zarfolio',
  description: 'Zarfolio workspace',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <body>
        <Script id="zarfolio-theme-bootstrap" strategy="beforeInteractive">
          {`(() => {
            try {
              const stored = localStorage.getItem('zarfolio-theme');
              const mode = stored === 'light' || stored === 'dark' || stored === 'system'
                ? stored
                : 'system';
              const theme = mode === 'system'
                ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
                : mode;
              document.documentElement.dataset.theme = theme;
              document.documentElement.dataset.themeMode = mode;
              document.documentElement.style.colorScheme = theme;
            } catch {
              const theme = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
              document.documentElement.dataset.theme = theme;
              document.documentElement.dataset.themeMode = 'system';
              document.documentElement.style.colorScheme = theme;
            }
          })();`}
        </Script>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}
