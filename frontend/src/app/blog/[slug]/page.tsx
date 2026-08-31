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
import api, { publicApi } from '@/lib/api'
import SiteNav from '@/components/layout/SiteNav'
import { useTheme } from '@/hooks/useTheme'
import { useLanguage } from '@/hooks/useLanguage'

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

const VIEW_DEDUPE_MS = 30 * 60 * 1000

const reservePostView = (slug: string) => {
  const key = `lumino:blog-view:${slug}`
  try {
    const viewedAt = Number(window.localStorage.getItem(key) || 0)
    if (Date.now() - viewedAt < VIEW_DEDUPE_MS) return null
    window.localStorage.setItem(key, String(Date.now()))
    return key
  } catch {
    return key
  }
}

export default function BlogPostDetail() {
  const params = useParams()
  const slug = params.slug as string
  const { isDark } = useTheme()
  const { t, formatDate } = useLanguage()

  const [post, setPost] = useState<BlogPost | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [shareStatus, setShareStatus] = useState<'idle' | 'copied' | 'error'>('idle')

  useEffect(() => {
    if (!slug) return

    let active = true
    const controller = new AbortController()
    const encodedSlug = encodeURIComponent(slug)

    publicApi
      .get(`/blog/posts/${encodedSlug}`, { signal: controller.signal })
      .then((response) => {
        if (!active) return
        setPost(response.data)

        const reservedKey = reservePostView(slug)
        if (reservedKey) {
          api.post(`/blog/posts/${encodedSlug}/view`).catch(() => {
            try {
              window.localStorage.removeItem(reservedKey)
            } catch {
              // Storage can be unavailable in privacy modes; a later visit may retry.
            }
          })
        }
      })
      .catch((requestError: any) => {
        if (!active || requestError?.code === 'ERR_CANCELED') return
        setError(requestError.response?.data?.detail || t.blog.postNotFound)
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
      controller.abort()
    }
  }, [slug, t.blog.postNotFound])

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
          text: post.excerpt || t.blog.shareText,
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

  const publicAuthorName = (author: UserResponse | null) => {
    const name = author?.display_name || author?.username
    const isAdmin = author?.is_root || name === '超级管理员' || name?.toLowerCase() === 'admin'
    return isAdmin ? t.blog.authorDefault : name || t.blog.authorDefault
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
        <p className="max-w-md text-lg font-semibold text-red-500">{error || t.blog.emptyTitle}</p>
        <Link
          href="/blog"
          className="inline-flex items-center gap-2 rounded-full bg-[#163a2b] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#24553f]"
        >
          <ArrowLeft size={15} />
          {t.blog.backToList}
        </Link>
      </div>
    )
  }

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

      <main className="relative mx-auto max-w-6xl px-4 py-5 md:px-8 md:py-7">
        <Link
          href="/blog"
          className="mx-auto mb-3 flex max-w-4xl items-center gap-2 text-sm font-semibold text-[#1d6347] transition hover:text-[#b56b19] dark:text-[#f7b84b]"
        >
          <ArrowLeft size={16} />
          {t.blog.backToBlog}
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
                {formatDate(post.published_at)}
              </span>
              <span className="flex items-center gap-1.5">
                <Eye size={14} />
                {t.blog.viewsWithCount.replace('{count}', String(post.view_count))}
              </span>
              <span className="flex items-center gap-1.5">
                <Clock3 size={14} />
                {t.blog.techEssay}
              </span>
              <button
                type="button"
                onClick={handleShare}
                className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-[#1d6347]/20 bg-white/70 px-3 py-2 font-semibold text-[#1d6347] transition hover:-translate-y-0.5 hover:border-[#1d6347]/45 hover:bg-[#e7efe8] focus:outline-none focus:ring-2 focus:ring-[#1d6347]/25 dark:border-[#f7b84b]/25 dark:bg-darkBg/50 dark:text-[#f7b84b] dark:hover:bg-[#163a2b]"
                aria-live="polite"
              >
                {shareStatus === 'copied' ? <Check size={14} /> : <Share2 size={14} />}
                {shareStatus === 'copied'
                  ? t.blog.shareCopied
                  : shareStatus === 'error'
                    ? t.common.copyFailed
                    : t.blog.shareArticle}
              </button>
            </div>

            {post.excerpt && (
              <aside className="mt-7 rounded-2xl border border-[#b56b19]/20 bg-[#fdf5e7] px-5 py-4 text-sm leading-7 text-[#5e482c] dark:bg-[#2e2518] dark:text-[#f7dfb8]">
                <strong className="mr-2">{t.blog.abstract}</strong>
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
          {t.blog.footerPost}
        </p>
      </footer>
    </div>
  )
}
