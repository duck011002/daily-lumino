'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  BookOpen,
  Calendar,
  Check,
  Clock3,
  Eye,
  Loader2,
  Share2,
  Tag,
  User,
} from 'lucide-react'
import dynamic from 'next/dynamic'
import api from '@/lib/api'
import SiteNav from '@/components/layout/SiteNav'
import { useTheme } from '@/hooks/useTheme'

const MDPreview = dynamic(
  () => import('@uiw/react-markdown-preview').then((mod) => mod.default),
  { ssr: false }
)

import '@uiw/react-markdown-preview/markdown.css'

interface UserResponse {
  username: string
  display_name: string | null
  is_root?: boolean
}

interface BlogPost {
  title: string
  slug: string
  content: string
  cover_url: string | null
  excerpt: string | null
  tags: string[] | null
  view_count: number
  published_at: string | null
  author: UserResponse | null
}

const publicAuthorName = (author: UserResponse | null) => {
  const name = author?.display_name || author?.username
  const isAdmin = author?.is_root || name === '超级管理员' || name?.toLowerCase() === 'admin'
  return isAdmin ? 'Lumino 编辑部' : name || 'Lumino 编辑部'
}

export default function BlogPostDetail() {
  const params = useParams()
  const slug = params.slug as string
  const { isDark } = useTheme()

  const [post, setPost] = useState<BlogPost | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [shareStatus, setShareStatus] = useState<'idle' | 'copied' | 'error'>('idle')

  useEffect(() => {
    if (!slug) return

    api.get(`/blog/posts/${slug}`)
      .then((response) => setPost(response.data))
      .catch((requestError: any) => {
        setError(requestError.response?.data?.detail || '无法获取文章内容或文章不存在。')
      })
      .finally(() => setLoading(false))
  }, [slug])

  const copyShareUrl = async (url: string) => {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url)
    } else {
      const textarea = document.createElement('textarea')
      textarea.value = url
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      const copied = document.execCommand('copy')
      textarea.remove()
      if (!copied) throw new Error('Copy failed')
    }
    setShareStatus('copied')
    window.setTimeout(() => setShareStatus('idle'), 2200)
  }

  const handleShare = async () => {
    if (!post) return
    const url = window.location.href
    try {
      if (navigator.share) {
        await navigator.share({
          title: post.title,
          text: post.excerpt || '来 Lumino 阅读这篇技术文章。',
          url,
        })
        return
      }
      await copyShareUrl(url)
    } catch (shareError: any) {
      if (shareError?.name === 'AbortError') return
      try {
        await copyShareUrl(url)
      } catch {
        setShareStatus('error')
        window.setTimeout(() => setShareStatus('idle'), 2200)
      }
    }
  }

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#eef1eb] dark:bg-darkBg">
        <Loader2 className="h-8 w-8 animate-spin text-[#b56b19]" />
      </div>
    )
  }

  if (error || !post) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-[#eef1eb] px-6 text-center dark:bg-darkBg">
        <p className="max-w-md text-lg font-semibold text-red-500">{error || '文章未找到'}</p>
        <Link
          href="/blog"
          className="inline-flex items-center gap-2 rounded-full bg-[#163a2b] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#24553f]"
        >
          <ArrowLeft size={15} />
          返回文章列表
        </Link>
      </div>
    )
  }

  const publishedLabel = post.published_at
    ? new Intl.DateTimeFormat('zh-CN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }).format(new Date(post.published_at))
    : '近期发布'

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#eef1eb] text-[#17211d] dark:bg-darkBg dark:text-foreground">
      <div
        className="pointer-events-none fixed inset-0 opacity-70 dark:opacity-20"
        style={{
          backgroundImage: 'radial-gradient(rgba(22, 58, 43, 0.08) 1px, transparent 1px)',
          backgroundSize: '18px 18px',
        }}
      />
      <div className="pointer-events-none fixed -left-32 top-28 h-96 w-96 rounded-full bg-[#d5e4d8] blur-3xl dark:bg-[#163a2b]/40" />
      <div className="pointer-events-none fixed -right-40 bottom-0 h-[30rem] w-[30rem] rounded-full bg-[#f7b84b]/15 blur-3xl" />

      <SiteNav />

      <main className="relative mx-auto max-w-6xl px-4 py-8 md:px-8 md:py-14">
        <Link
          href="/blog"
          className="mx-auto mb-5 flex max-w-4xl items-center gap-2 text-sm font-semibold text-[#1d6347] transition hover:text-[#b56b19] dark:text-[#f7b84b]"
        >
          <ArrowLeft size={16} />
          返回博客
        </Link>
        <article className="mx-auto max-w-4xl overflow-hidden rounded-[2rem] border border-[#17211d]/10 bg-[#fffdf8] shadow-[0_32px_90px_-48px_rgba(23,33,29,0.6)] dark:border-darkBorder dark:bg-darkCard">
          {post.cover_url && (
            <div className="relative h-56 overflow-hidden md:h-80">
              <img src={post.cover_url} alt={post.title} className="h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#17211d]/40 via-transparent to-transparent" />
            </div>
          )}

          <div className="px-6 py-9 md:px-12 md:py-14">
            {post.tags && post.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {post.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 rounded-full bg-[#e7efe8] px-3 py-1 text-xs font-semibold text-[#1d6347] dark:bg-[#163a2b] dark:text-[#f7b84b]"
                  >
                    <Tag size={10} />
                    {tag}
                  </span>
                ))}
              </div>
            )}

            <h1 className="mt-5 font-display text-3xl font-bold leading-tight md:text-5xl">
              {post.title}
            </h1>

            <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 border-y border-[#17211d]/10 py-4 text-xs text-[#17211d]/55 dark:border-darkBorder dark:text-foreground/55 md:text-sm">
              <span className="flex items-center gap-1.5 font-semibold text-[#1d6347] dark:text-[#f7b84b]">
                <User size={14} />
                {publicAuthorName(post.author)}
              </span>
              <span className="flex items-center gap-1.5">
                <Calendar size={14} />
                {publishedLabel}
              </span>
              <span className="flex items-center gap-1.5">
                <Eye size={14} />
                {post.view_count} 次阅读
              </span>
              <span className="flex items-center gap-1.5">
                <Clock3 size={14} />
                技术随笔
              </span>
              <button
                type="button"
                onClick={handleShare}
                className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-[#1d6347]/20 bg-white/70 px-3 py-2 font-semibold text-[#1d6347] transition hover:-translate-y-0.5 hover:border-[#1d6347]/45 hover:bg-[#e7efe8] focus:outline-none focus:ring-2 focus:ring-[#1d6347]/25 dark:border-[#f7b84b]/25 dark:bg-darkBg/50 dark:text-[#f7b84b] dark:hover:bg-[#163a2b]"
                aria-live="polite"
              >
                {shareStatus === 'copied' ? <Check size={14} /> : <Share2 size={14} />}
                {shareStatus === 'copied' ? '链接已复制' : shareStatus === 'error' ? '复制失败' : '分享文章'}
              </button>
            </div>

            {post.excerpt && (
              <aside className="mt-7 rounded-2xl border border-[#b56b19]/20 bg-[#fdf5e7] px-5 py-4 text-sm leading-7 text-[#5e482c] dark:bg-[#2e2518] dark:text-[#f7dfb8]">
                <strong className="mr-2">摘要</strong>
                {post.excerpt}
              </aside>
            )}

            <div
              className="mt-10 border-t border-[#17211d]/10 pt-8 dark:border-darkBorder"
              data-color-mode={isDark ? 'dark' : 'light'}
            >
              <div className="prose max-w-none dark:prose-invert [&_.wmde-markdown]:!bg-transparent [&_.wmde-markdown]:!text-inherit">
                <MDPreview source={post.content} style={{ backgroundColor: 'transparent' }} />
              </div>
            </div>
          </div>
        </article>
      </main>

      <footer className="relative border-t border-[#17211d]/10 bg-[#eef1eb]/70 py-8 text-center dark:border-darkBorder dark:bg-darkBg/70">
        <p className="flex items-center justify-center gap-1 text-xs text-[#17211d]/45 dark:text-foreground/45">
          <BookOpen size={12} className="text-[#b56b19]" />
          Lumino 编辑部 · 技术实践与思考
        </p>
      </footer>
    </div>
  )
}
