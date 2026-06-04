import React from 'react'
import type { Metadata } from 'next'
import { Outfit, Playfair_Display } from 'next/font/google'
import { ThemeProvider } from 'next-themes'
import { AuthProvider } from '@/hooks/useAuth'
import './globals.css'

const outfit = Outfit({ subsets: ['latin'], variable: '--font-outfit' })
const playfair = Playfair_Display({ subsets: ['latin'], variable: '--font-playfair' })

export const metadata: Metadata = {
  title: 'Lumino',
  description: '您的私密生活空间',
  manifest: '/manifest.json',
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
  themeColor: '#E8814A',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className={`${outfit.variable} ${playfair.variable} font-sans min-h-screen flex flex-col`}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
          <AuthProvider>
            {children}
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
