import type { Metadata } from 'next'
import './globals.css'
import './document-form.css'
import ThemeProvider from '@/src/components/ThemeProvider'
import { SettingsProvider } from '@/src/components/SettingsProvider'
import PwaInstallPrompt from '@/src/components/PwaInstallPrompt'

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
      <head>
        <meta name="color-scheme" content="dark light" />
        <meta name="theme-color" content="#1e293b" />
        <link rel="apple-touch-icon" href="/favicon.ico" />
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
