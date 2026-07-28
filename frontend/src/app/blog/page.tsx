'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  ArrowUpRight,
  BookOpen,
  Calendar,
  ChevronRight,
  Code2,
  Eye,
  Loader2,
  Settings2,
  Tag,
  User,
} from 'lucide-react'
import api from '@/lib/api'
import ThemeToggle from '@/components/layout/ThemeToggle'
import { useAuth } from '@/hooks/useAuth'

interface BlogCategory {
  id: number
  name: string
  slug: string
  description: string | null
}

interface BlogPost {
  id: number
  title: string
  slug: string
  cover_url: string | null
  excerpt: string | null
  tags: string[] | null
  view_count: number
  published_at: string | null
  created_at: string
  author: { username: string; display_name: string | null } | null
  category: BlogCategory | null
}

const formatDate = (value: string | null) =>
  value ? new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(value)) : '近期发布'

export default function PublicBlogList() {
  const { user } = useAuth()
  const [posts, setPosts] = useState<BlogPost[]>([])
  const [categories, setCategories] = useState<BlogCategory[]>([])
  const [activeCategory, setActiveCategory] = useState('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const loadBlog = async () => {
      try {
        const [postRes, categoryRes] = await Promise.all([api.get('/blog/posts'), api.get('/blog/categories')])
        setPosts(postRes.data)
        setCategories(categoryRes.data)
      } catch (err: any) {
        setError(err.response?.data?.detail || '加载技术博客失败，请稍后重试。')
      } finally {
        setLoading(false)
      }
    }
    loadBlog()
  }, [])

  const visiblePosts = activeCategory === 'all' ? posts : posts.filter((post) => post.category?.slug === activeCategory)
  const featuredPost = visiblePosts[0]
  const remainingPosts = featuredPost ? visiblePosts.slice(1) : []
  const canWrite = Boolean(user?.is_root || user?.can_write_blog)

  return (
    <div className="min-h-screen bg-[#f6f4ee] text-[#17211d] dark:bg-darkBg dark:text-foreground">
      <header className="sticky top-0 z-30 border-b border-[#17211d]/10 bg-[#f6f4ee]/90 backdrop-blur dark:border-darkBorder dark:bg-darkBg/90">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 md:px-8">
          <Link href="/" className="flex items-center gap-2 font-display text-lg font-bold tracking-tight">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#163a2b] text-[#f7b84b]"><Code2 size={17} /></span>
            Lumino / Notes
          </Link>
          <div className="flex items-center gap-2">
            {canWrite && (
              <Link href="/blog/manage" className="hidden items-center gap-2 rounded-full bg-[#163a2b] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#24553f] sm:flex">
                <Settings2 size={15} /> 文章管理
              </Link>
            )}
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 pb-20 pt-10 md:px-8 md:pt-16">
        <section className="relative overflow-hidden rounded-[2rem] border border-[#17211d]/10 bg-[#163a2b] px-7 py-12 text-white shadow-[0_28px_80px_-42px_rgba(22,58,43,0.9)] md:px-12 md:py-16">
          <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full border-[30px] border-[#f7b84b]/20" />
          <div className="absolute bottom-0 left-1/3 h-24 w-2/3 bg-gradient-to-r from-transparent via-[#f7b84b]/20 to-transparent" />
          <p className="relative text-xs font-bold uppercase tracking-[0.28em] text-[#f7b84b]">Technical portfolio</p>
          <h1 className="relative mt-5 max-w-3xl font-display text-4xl font-bold leading-[1.08] md:text-6xl">
            把实践沉淀成<br />可阅读的技术能力。
          </h1>
          <p className="relative mt-6 max-w-2xl text-sm leading-7 text-white/75 md:text-base">
            Agent、Skill、深度学习与工程实践。这里不是信息流，而是一份持续更新的技术作品集。
          </p>
          <div className="relative mt-8 flex flex-wrap gap-3 text-sm text-white/80">
            <span className="rounded-full border border-white/20 px-4 py-2">{posts.length} 篇公开文章</span>
            <span className="rounded-full border border-white/20 px-4 py-2">{categories.length} 个技术分区</span>
          </div>
        </section>

        <section className="mt-10">
          <div className="flex flex-col gap-5 border-b border-[#17211d]/10 pb-5 dark:border-darkBorder md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#b56b19]">Explore by focus</p>
              <h2 className="mt-2 font-display text-2xl font-bold">技术分区</h2>
            </div>
            <p className="text-sm text-[#17211d]/55 dark:text-foreground/55">从一个明确的主题开始了解我的工作方式。</p>
          </div>
          <div className="mt-5 flex gap-3 overflow-x-auto pb-2">
            <button onClick={() => setActiveCategory('all')} className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition ${activeCategory === 'all' ? 'bg-[#163a2b] text-white' : 'border border-[#17211d]/15 bg-white/70 text-[#17211d]/70 hover:border-[#163a2b] dark:border-darkBorder dark:bg-darkCard dark:text-foreground/70'}`}>全部文章</button>
            {categories.map((category) => (
              <button key={category.id} onClick={() => setActiveCategory(category.slug)} className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition ${activeCategory === category.slug ? 'bg-[#163a2b] text-white' : 'border border-[#17211d]/15 bg-white/70 text-[#17211d]/70 hover:border-[#163a2b] dark:border-darkBorder dark:bg-darkCard dark:text-foreground/70'}`}>
                {category.name}
              </button>
            ))}
          </div>
        </section>

        {loading ? (
          <div className="grid min-h-80 place-items-center"><Loader2 className="h-8 w-8 animate-spin text-[#b56b19]" /></div>
        ) : error ? (
          <div className="mt-10 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-600 dark:border-red-500/30 dark:bg-red-500/10">{error}</div>
        ) : !featuredPost ? (
          <div className="mt-10 rounded-[2rem] border border-dashed border-[#17211d]/20 bg-white/50 px-6 py-20 text-center dark:border-darkBorder dark:bg-darkCard/30">
            <BookOpen className="mx-auto h-8 w-8 text-[#b56b19]" />
            <h3 className="mt-4 font-display text-xl font-bold">这个分区正在整理中</h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-[#17211d]/55 dark:text-foreground/55">先从其他技术分区看看，新的实践文章会持续补充。</p>
          </div>
        ) : (
          <section className="mt-10">
            <Link href={`/blog/${featuredPost.slug}`} className="group grid overflow-hidden rounded-[2rem] border border-[#17211d]/10 bg-white shadow-[0_24px_70px_-45px_rgba(23,33,29,0.65)] transition hover:-translate-y-1 dark:border-darkBorder dark:bg-darkCard md:grid-cols-[1.2fr_0.8fr]">
              <div className="relative min-h-72 overflow-hidden bg-[#dce9df] dark:bg-[#173126]">
                {featuredPost.cover_url ? <img src={featuredPost.cover_url} alt="" className="h-full w-full object-cover transition duration-700 group-hover:scale-105" /> : <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_20%,#f7b84b_0,transparent_27%),linear-gradient(135deg,#1e513b,#0b2118)]" />}
                <div className="absolute bottom-5 left-5 rounded-full bg-[#f7b84b] px-3 py-1 text-xs font-bold text-[#17211d]">精选阅读</div>
              </div>
              <div className="flex flex-col justify-between p-7 md:p-10">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#b56b19]">{featuredPost.category?.name || 'Uncategorized'}</p>
                  <h2 className="mt-4 font-display text-3xl font-bold leading-tight group-hover:text-[#1d6347] dark:group-hover:text-[#f7b84b]">{featuredPost.title}</h2>
                  <p className="mt-4 line-clamp-3 text-sm leading-7 text-[#17211d]/60 dark:text-foreground/60">{featuredPost.excerpt || '打开文章，查看完整的实践记录、思考过程与结论。'}</p>
                </div>
                <div className="mt-8 flex items-center justify-between text-sm font-semibold"><span className="flex items-center gap-2 text-[#17211d]/55 dark:text-foreground/55"><Calendar size={15} />{formatDate(featuredPost.published_at)}</span><span className="flex items-center gap-1 text-[#163a2b] dark:text-[#f7b84b]">阅读全文 <ArrowUpRight size={17} /></span></div>
              </div>
            </Link>

            {remainingPosts.length > 0 && <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">{remainingPosts.map((post) => <ArticleCard key={post.id} post={post} />)}</div>}
          </section>
        )}
      </main>
    </div>
  )
}

function ArticleCard({ post }: { post: BlogPost }) {
  return <Link href={`/blog/${post.slug}`} className="group flex min-h-64 flex-col rounded-3xl border border-[#17211d]/10 bg-white p-6 transition hover:-translate-y-1 hover:border-[#1d6347]/50 hover:shadow-xl dark:border-darkBorder dark:bg-darkCard">
    <div className="flex items-center justify-between"><span className="text-xs font-bold uppercase tracking-[0.14em] text-[#b56b19]">{post.category?.name || 'Uncategorized'}</span><ChevronRight size={18} className="text-[#17211d]/35 transition group-hover:translate-x-1 group-hover:text-[#1d6347] dark:text-foreground/35" /></div>
    <h3 className="mt-5 font-display text-xl font-bold leading-snug group-hover:text-[#1d6347] dark:group-hover:text-[#f7b84b]">{post.title}</h3>
    <p className="mt-3 line-clamp-3 text-sm leading-6 text-[#17211d]/60 dark:text-foreground/60">{post.excerpt || '打开文章查看完整内容。'}</p>
    <div className="mt-auto pt-6"><div className="flex flex-wrap gap-1.5">{post.tags?.slice(0, 3).map((tag) => <span key={tag} className="inline-flex items-center gap-1 rounded-md bg-[#f1eee5] px-2 py-1 text-[11px] text-[#17211d]/65 dark:bg-darkBg dark:text-foreground/65"><Tag size={10} />{tag}</span>)}</div><div className="mt-4 flex items-center justify-between text-xs text-[#17211d]/45 dark:text-foreground/45"><span className="flex items-center gap-1"><User size={12} />{post.author?.display_name || post.author?.username || 'Lumino'}</span><span className="flex items-center gap-1"><Eye size={12} />{post.view_count}</span></div></div>
  </Link>
}
