'use client'

import React from 'react'
import Link from 'next/link'
import { Sparkles, Lock, Image as ImageIcon, FileText, BookOpen, ChevronRight } from 'lucide-react'
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
    {
      icon: BookOpen,
      title: '个人公开博客',
      desc: '静谧的写作环境，将你的思绪分享给懂你的人。',
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
            探寻专属于你的 <br />
            <span className="text-primary bg-clip-text">私密生活空间</span>
          </h1>
          <p className="text-lg md:text-xl text-onSurface/70 dark:text-foreground/70 max-w-2xl mx-auto">
            Lumino 是集 AI 智能伴侣、多维私密空间、时光相簿、Markdown 协同笔记与极简博客为一体的数字避风港。
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-6">
            {user ? (
              <Link href="/dashboard" passHref>
                <Button id="btn-hero-dashboard" size="lg" className="w-full sm:w-auto">
                  我的仪表盘 <ChevronRight className="ml-1 h-5 w-5" />
                </Button>
              </Link>
            ) : (
              <>
                <Link href="/register" passHref>
                  <Button id="btn-hero-register" size="lg" className="w-full sm:w-auto">
                    即刻加入 <ChevronRight className="ml-1 h-5 w-5" />
                  </Button>
                </Link>
                <Link href="/login" passHref>
                  <Button id="btn-hero-login" variant="outline" size="lg" className="w-full sm:w-auto">
                    登录账户
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Features list grid */}
        <section className="mt-24 w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feat, idx) => (
            <div
              key={idx}
              className="p-8 rounded-3xl bg-white/50 dark:bg-darkCard/50 border border-secondary dark:border-darkBorder hover:border-primary/50 dark:hover:border-primary/50 transition-all duration-300 hover:shadow-xl group hover:translate-y-[-4px]"
            >
              <div className="h-12 w-12 rounded-2xl bg-secondary dark:bg-darkBorder flex items-center justify-center text-primary mb-6 group-hover:bg-primary group-hover:text-white transition-colors duration-300">
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
