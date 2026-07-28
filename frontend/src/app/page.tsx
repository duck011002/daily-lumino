'use client'

import React from 'react'
import Link from 'next/link'
import { ArrowUpRight, Sparkles, Lock, Image as ImageIcon, FileText, BookOpen, ChevronRight } from 'lucide-react'
import ThemeToggle from '@/components/layout/ThemeToggle'
import Button from '@/components/ui/Button'
import { useAuth } from '@/hooks/useAuth'

export default function Home() {
  const { user } = useAuth()

  const features = [
    {
      icon: Sparkles,
      title: 'AI 智能伴侣',
      desc: '搭载先进大语言模型，支持多模态对话，倾听你的心声。',
    },
    {
      icon: Lock,
      title: '私密生活空间',
      desc: '专属于你和至亲之人的避风港，支持情侣、家庭和挚友空间。',
    },
    {
      icon: ImageIcon,
      title: '时光相册相簿',
      desc: '记录珍贵的瞬间，超大云端配额，多维呈现生活足迹。',
    },
    {
      icon: FileText,
      title: 'Markdown 笔记',
      desc: '支持多人实时编辑锁机制，共同续写岁月的记忆。',
    },
  ]

  return (
    <div className="flex-1 flex flex-col relative overflow-hidden bg-surface dark:bg-darkBg transition-colors duration-300">
      {/* Background patterns */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-primary/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-primary/5 rounded-full blur-[100px] pointer-events-none" />

      {/* Header */}
      <header className="w-full max-w-7xl mx-auto px-6 h-20 flex items-center justify-between z-10">
        <div className="flex items-center space-x-2">
          <span className="font-display text-2xl font-bold tracking-wide text-primary">Lumino</span>
        </div>
        <div className="flex items-center space-x-4">
          <ThemeToggle />
          {user ? (
            <Link href="/dashboard" passHref>
              <Button id="btn-header-dashboard" size="sm">
                进入空间
              </Button>
            </Link>
          ) : (
            <>
              <Link href="/login" passHref>
                <Button id="btn-header-login" variant="ghost" size="sm">
                  登录
                </Button>
              </Link>
              <Link href="/register" passHref>
                <Button id="btn-header-register" size="sm">
                  注册
                </Button>
              </Link>
            </>
          )}
        </div>
      </header>

      {/* Main hero section */}
      <main className="flex-1 max-w-7xl mx-auto px-6 flex flex-col justify-center items-center text-center z-10 py-16">
        <div className="space-y-6 max-w-3xl animate-fade-in">
          <h1 className="text-5xl md:text-7xl font-display font-bold text-onSurface dark:text-foreground leading-tight">
            把私密生活与<br />
            <span className="text-primary bg-clip-text">技术实践</span>分开安放
          </h1>
          <p className="text-lg md:text-xl text-onSurface/70 dark:text-foreground/70 max-w-2xl mx-auto">
            技术博客对所有访客开放；其余记录、对话与协作空间只在登录后为你和受邀成员服务。
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-6">
            {user ? (
              <Link href="/blog" passHref>
                <Button id="btn-hero-dashboard" size="lg" className="w-full sm:w-auto">
                  浏览技术博客 <ChevronRight className="ml-1 h-5 w-5" />
                </Button>
              </Link>
            ) : (
              <>
                <Link href="/blog" passHref>
                  <Button id="btn-hero-register" size="lg" className="w-full sm:w-auto">
                    浏览技术博客 <ChevronRight className="ml-1 h-5 w-5" />
                  </Button>
                </Link>
                <Link href="/login" passHref>
                  <Button id="btn-hero-login" variant="outline" size="lg" className="w-full sm:w-auto">
                    登录私人空间
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>

        <section className="mt-20 w-full rounded-[2rem] border border-primary/20 bg-primary/[0.04] p-7 text-left dark:bg-primary/[0.08] md:p-10">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Public entry</p>
              <h2 className="mt-3 font-display text-3xl font-bold text-onSurface dark:text-foreground">公开技术作品集</h2>
              <p className="mt-3 text-sm leading-7 text-onSurface/65 dark:text-foreground/65">浏览 Agent、MCP、深度学习与工程实践。这里是访客唯一可直接进入的内容区域。</p>
            </div>
            <Link href="/blog" className="inline-flex shrink-0 items-center gap-2 self-start rounded-xl bg-primary px-5 py-3 text-sm font-bold text-white transition hover:bg-primary/90 md:self-auto">
              进入技术博客 <ArrowUpRight size={17} />
            </Link>
          </div>
        </section>

        <section className="mt-14 w-full">
          <div className="mb-6 text-left">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-onSurface/45 dark:text-foreground/45">Private workspace</p>
            <h2 className="mt-2 font-display text-2xl font-bold text-onSurface dark:text-foreground">登录后可用的私人能力</h2>
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          {features.map((feat, idx) => (
            <div
              key={idx}
              className="relative rounded-3xl border border-secondary bg-white/50 p-7 dark:border-darkBorder dark:bg-darkCard/50"
            >
              <span className="absolute right-5 top-5 rounded-full bg-secondary px-2.5 py-1 text-[10px] font-bold text-onSurface/50 dark:bg-darkBorder dark:text-foreground/50">需登录</span>
              <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary text-primary dark:bg-darkBorder">
                <feat.icon className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold text-onSurface dark:text-foreground mb-3 text-left">
                {feat.title}
              </h3>
              <p className="text-onSurface/70 dark:text-foreground/70 text-sm leading-relaxed text-left">
                {feat.desc}
              </p>
            </div>
          ))}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="w-full py-8 text-center border-t border-secondary dark:border-darkBorder z-10">
        <p className="text-xs text-onSurface/40 dark:text-foreground/40">
          &copy; {new Date().getFullYear()} Lumino. 保留所有权利.
        </p>
      </footer>
    </div>
  )
}
