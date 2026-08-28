import React from 'react'
import type { Metadata } from 'next'
import { Outfit, Playfair_Display } from 'next/font/google'
import { ThemeProvider } from 'next-themes'
import { AuthProvider } from '@/hooks/useAuth'
import VisitTracker from '@/components/analytics/VisitTracker'
import { LanguageProvider } from '@/hooks/useLanguage'
import './globals.css'

const outfit = Outfit({ subsets: ['latin'], variable: '--font-outfit' })
const playfair = Playfair_Display({ subsets: ['latin'], variable: '--font-playfair' })

export const metadata: Metadata = {
  title: 'Lumino',
  description: '一座收藏技术、阅读与生活的个人数字庭院',
  manifest: '/manifest.json',
  icons: {
    icon: [{ url: '/brand/lumino-mark.svg', type: 'image/svg+xml' }],
    apple: '/icons/icon-192.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Lumino',
  },
  formatDetection: {
    telephone: false,
  },
}

export const viewport = {
  themeColor: '#123C2D',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className={`${outfit.variable} ${playfair.variable} font-sans min-h-screen flex flex-col`}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
          <LanguageProvider>
            <AuthProvider>
              <VisitTracker />
              {children}
            </AuthProvider>
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
