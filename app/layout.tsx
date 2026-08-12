import type { Metadata } from 'next'
import './globals.css'
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
    <html lang="fa" dir="rtl">
      <body><ThemeProvider>{children}</ThemeProvider></body>
    </html>
  )
}
