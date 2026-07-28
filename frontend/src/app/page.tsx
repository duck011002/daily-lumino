'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowUpRight, Calendar, FileText, Image as ImageIcon, Lock, Sparkles } from 'lucide-react'
import ThemeToggle from '@/components/layout/ThemeToggle'
import Button from '@/components/ui/Button'
import { useAuth } from '@/hooks/useAuth'
import api from '@/lib/api'

interface FeaturedPost {
  id: number
  title: string
  slug: string
  excerpt: string | null
  cover_url: string | null
  published_at: string | null
  category: { name: string } | null
}

const formatDate = (value: string | null) =>
  value ? new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(value)) : '近期发布'

export default function Home() {
  const { user } = useAuth()
  const [featuredPosts, setFeaturedPosts] = useState<FeaturedPost[]>([])

  useEffect(() => {
    api.get('/blog/featured').then((response) => setFeaturedPosts(response.data)).catch(() => setFeaturedPosts([]))
  }, [])

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

      <main className="flex-1 max-w-7xl mx-auto px-6 z-10 py-8 md:py-12">
        <section className="w-full text-left">
          <div className="flex items-end justify-between border-b border-secondary pb-5 dark:border-darkBorder">
            <div><p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Selected writing</p><h2 className="mt-2 font-display text-3xl font-bold text-onSurface dark:text-foreground">精选文章</h2></div>
            <span className="hidden text-sm text-onSurface/50 dark:text-foreground/50 sm:block">最近发布优先</span>
          </div>
          {featuredPosts.length ? <div className="mt-6 grid gap-5 md:grid-cols-2 lg:grid-cols-3">{featuredPosts.map((post) => <Link key={post.id} href={`/blog/${post.slug}`} className="group relative flex min-h-64 flex-col overflow-hidden rounded-3xl border border-secondary bg-white p-6 shadow-[0_20px_55px_-45px_rgba(22,24,23,0.75)] transition hover:-translate-y-1 hover:border-primary/45 hover:shadow-xl dark:border-darkBorder dark:bg-darkCard"><div className="absolute inset-x-0 top-0 h-1 bg-primary/70" />{post.cover_url && <img src={post.cover_url} alt="" className="absolute inset-0 h-full w-full object-cover opacity-[0.07] transition duration-500 group-hover:scale-105 group-hover:opacity-[0.12]" />}<div className="relative"><span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-bold text-primary">{post.category?.name || '技术实践'}</span><h3 className="mt-5 font-display text-xl font-bold leading-snug text-onSurface dark:text-foreground">{post.title}</h3><p className="mt-3 line-clamp-3 text-sm leading-6 text-onSurface/60 dark:text-foreground/60">{post.excerpt || '打开文章，查看完整的实践记录与实现细节。'}</p></div><div className="relative mt-auto flex items-center justify-between pt-6 text-xs font-semibold text-onSurface/45 dark:text-foreground/45"><span className="flex items-center gap-1"><Calendar size={13} />{formatDate(post.published_at)}</span><ArrowUpRight size={18} className="text-primary transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" /></div></Link>)}</div> : <div className="mt-6 rounded-3xl border border-dashed border-secondary bg-white/45 px-6 py-10 text-center dark:border-darkBorder dark:bg-darkCard/30"><p className="font-display text-lg font-bold text-onSurface dark:text-foreground">精选内容正在整理</p><p className="mt-2 text-sm text-onSurface/55 dark:text-foreground/55">新的技术实践会在完成审核后出现在这里。</p></div>}
          <div className="mt-5 flex justify-end"><Link href="/blog" className="group inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold text-primary transition hover:bg-primary/10 focus:outline-none focus:ring-2 focus:ring-primary/30">浏览更多博客 <ArrowUpRight size={17} className="transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" /></Link></div>
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
