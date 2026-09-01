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

// 1. 基础 SEO、Canonical 与 Open Graph 配置
export const metadata: Metadata = {
  metadataBase: new URL('https://lovestory1314.fun'),
  title: {
    default: 'Lumino | 个人数字花园 · 技术沉淀与生活阅读记录',
    template: '%s | Lumino 数字花园',
  },
  description:
    '一座支持 MCP 博客、MCP Todo、MCP 记账并深度集成 Model Context Protocol 的个人数字庭院，沉淀全栈开发、后端架构与机器学习研究的高价值实践。',
  keywords: [
    'Lumino',
    '数字花园',
    '个人博客',
    'MCP',
    'Model Context Protocol',
    'MCP博客',
    'mcp blog',
    'MCP Todo',
    'mcp todo',
    'MCP记账',
    '全栈开发',
    '后端架构',
    '机器学习',
    'FastAPI',
    'Next.js',
    '知识管理',
    '技术实践',
  ],
  alternates: {
    canonical: '/',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    title: 'Lumino | 个人数字花园 · 技术沉淀与生活阅读记录',
    description:
      '一座支持 MCP 博客、MCP Todo、MCP 记账并深度集成 Model Context Protocol 的个人数字庭院，沉淀全栈开发、后端架构与机器学习研究的高价值实践。',
    url: 'https://lovestory1314.fun',
    siteName: 'Lumino',
    locale: 'zh_CN',
    type: 'website',
    images: [
      {
        url: '/i/2026/08/27/6a90081e86845.png',
        width: 1200,
        height: 630,
        alt: 'Lumino 数字花园',
      },
    ],
  },
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

// 2. Schema.org 站点级结构化数据 (JSON-LD)
const schemaWebsite = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'Lumino',
  url: 'https://lovestory1314.fun',
  description:
    '一座支持 MCP 博客、MCP Todo、MCP 记账并深度集成 Model Context Protocol 的个人数字庭院',
  author: {
    '@type': 'Person',
    name: 'Lumino',
    url: 'https://lovestory1314.fun',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaWebsite) }}
        />
      </head>
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
