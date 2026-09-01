'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  BookOpen,
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Eye,
  ListTree,
  Loader2,
  PanelLeftClose,
  PanelLeftOpen,
  Share2,
  Tag,
  User,
  X,
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
import {
  BlogAdjacentPost,
  BlogPost,
  UserResponse,
  extractTocHeadings,
  getEnhancedAlt,
  TocItem,
} from './utils'

export type { BlogAdjacentPost, BlogPost, TocItem, UserResponse }
export { getEnhancedAlt }

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

export default function BlogPostClient({
  slug,
  initialPost = null,
}: {
  slug: string
  initialPost?: BlogPost | null
}) {
  const { isDark } = useTheme()
  const { t, formatDate } = useLanguage()

  const [post, setPost] = useState<BlogPost | null>(initialPost)
  const [loading, setLoading] = useState(!initialPost)
  const [error, setError] = useState('')
  const [shareStatus, setShareStatus] = useState<'idle' | 'copied' | 'error'>('idle')

  // TOC states
  const [isTocExpanded, setIsTocExpanded] = useState(true)
  const [mobileTocOpen, setMobileTocOpen] = useState(false)
  const [activeId, setActiveId] = useState('')
  const [progress, setProgress] = useState(0)

  const contentRef = useRef<HTMLDivElement>(null)

  // Extract TOC headings from markdown
  const tocItems = useMemo(
    () => (post?.content ? extractTocHeadings(post.content) : []),
    [post?.content]
  )

  useEffect(() => {
    if (!slug) return

    let active = true
    const controller = new AbortController()
    const encodedSlug = encodeURIComponent(slug)

    // 记录浏览量
    const reservedKey = reservePostView(slug)
    if (reservedKey) {
      api.post(`/blog/posts/${encodedSlug}/view`).catch(() => {
        try {
          window.localStorage.removeItem(reservedKey)
        } catch {
          // Storage can be unavailable in privacy modes
        }
      })
    }

    if (!initialPost) {
      publicApi
        .get(`/blog/posts/${encodedSlug}`, { signal: controller.signal })
        .then((response) => {
          if (!active) return
          setPost(response.data)
        })
        .catch((requestError: any) => {
          if (!active || requestError?.code === 'ERR_CANCELED') return
          setError(requestError.response?.data?.detail || t.blog.postNotFound)
        })
        .finally(() => {
          if (active) setLoading(false)
        })
    }

    return () => {
      active = false
      controller.abort()
    }
  }, [slug, initialPost, t.blog.postNotFound])

  // Track Reading Progress
  useEffect(() => {
    const handleScroll = () => {
      const totalHeight = document.documentElement.scrollHeight - window.innerHeight
      if (totalHeight > 0) {
        const current = Math.min(100, Math.max(0, Math.round((window.scrollY / totalHeight) * 100)))
        setProgress(current)
      }
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Assign IDs to rendered Markdown headings & Setup IntersectionObserver
  useEffect(() => {
    if (!post?.content || tocItems.length === 0) return

    const timer = setTimeout(() => {
      const container = contentRef.current
      if (!container) return

      const headingElements = container.querySelectorAll<HTMLHeadingElement>(
        'h1, h2, h3, h4, h5, h6'
      )

      headingElements.forEach((el, index) => {
        if (index < tocItems.length) {
          el.id = tocItems[index].id
          el.style.scrollMarginTop = '96px'
        }
      })

      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting && entry.target.id) {
              setActiveId(entry.target.id)
            }
          })
        },
        { rootMargin: '-80px 0px -60% 0px' }
      )

      headingElements.forEach((el) => observer.observe(el))

      return () => {
        headingElements.forEach((el) => observer.unobserve(el))
      }
    }, 400)

    return () => clearTimeout(timer)
  }, [post?.content, tocItems])

  const handleScrollTo = useCallback((id: string) => {
    const element = document.getElementById(id)
    if (element) {
      const yOffset = -96
      const y = element.getBoundingClientRect().top + window.pageYOffset + yOffset
      window.scrollTo({ top: y, behavior: 'smooth' })
      setActiveId(id)
      setMobileTocOpen(false)
    }
  }, [])

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

      {/* 桌面端折叠状态下触发浮动按钮 */}
      {tocItems.length > 0 && !isTocExpanded && (
        <button
          type="button"
          onClick={() => setIsTocExpanded(true)}
          className="hidden xl:flex fixed left-6 top-28 z-40 items-center gap-2 rounded-full border border-[#17211d]/10 bg-[#fffdf8]/90 px-3.5 py-2 text-xs font-semibold text-[#1d6347] shadow-lg backdrop-blur-md transition-all hover:scale-105 hover:border-[#1d6347]/30 hover:bg-white dark:border-darkBorder dark:bg-darkCard/90 dark:text-[#f7b84b] dark:hover:bg-darkCard"
          title={t.blog.expandToc}
        >
          <PanelLeftOpen size={16} />
          <span>{t.blog.tocTitle}</span>
        </button>
      )}

      {/* 移动端浮动大纲抽屉开关 */}
      {tocItems.length > 0 && (
        <div className="xl:hidden">
          <button
            type="button"
            onClick={() => setMobileTocOpen(true)}
            className="fixed bottom-6 right-6 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-[#1d6347] text-white shadow-xl transition-all hover:scale-105 active:scale-95 dark:bg-[#f7b84b] dark:text-[#17211d]"
            aria-label={t.blog.tocTitle}
          >
            <ListTree size={20} />
          </button>

          {/* 移动端大纲弹层 */}
          {mobileTocOpen && (
            <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 backdrop-blur-sm">
              <div className="max-h-[75vh] w-full max-w-lg overflow-hidden rounded-3xl border border-[#17211d]/10 bg-[#fffdf8] p-6 shadow-2xl dark:border-darkBorder dark:bg-darkCard">
                <div className="flex items-center justify-between pb-3 border-b border-[#17211d]/10 dark:border-darkBorder">
                  <div className="flex items-center gap-2 text-base font-bold text-[#17211d] dark:text-foreground">
                    <ListTree size={18} className="text-[#1d6347] dark:text-[#f7b84b]" />
                    <span>{t.blog.tocTitle}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMobileTocOpen(false)}
                    className="rounded-full p-1.5 text-[#17211d]/60 hover:bg-[#17211d]/5 dark:text-foreground/60 dark:hover:bg-white/5"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="mt-3">
                  <div className="flex items-center justify-between text-xs text-[#17211d]/55 dark:text-foreground/55 mb-1">
                    <span>{t.blog.readingProgress}</span>
                    <span className="font-semibold text-[#1d6347] dark:text-[#f7b84b]">{progress}%</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#17211d]/10 dark:bg-darkBorder">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#1d6347] to-[#b56b19] dark:from-[#f7b84b] dark:to-[#1d6347]"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>

                <nav className="mt-4 max-h-[50vh] overflow-y-auto space-y-1 pr-1 text-sm">
                  {tocItems.map((item) => {
                    const isActive = activeId === item.id
                    const indentClass =
                      item.level === 1 ? 'font-bold' : item.level === 2 ? 'pl-3 font-semibold' : item.level === 3 ? 'pl-6' : 'pl-8'
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleScrollTo(item.id)}
                        className={`flex w-full items-start text-left py-2 px-2.5 rounded-xl transition ${indentClass} ${
                          isActive
                            ? 'bg-[#1d6347]/10 text-[#1d6347] font-semibold dark:bg-[#f7b84b]/15 dark:text-[#f7b84b]'
                            : 'text-[#17211d]/75 hover:bg-[#17211d]/5 dark:text-foreground/75 dark:hover:bg-white/5'
                        }`}
                      >
                        <span className={`mr-2 mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full ${
                          isActive ? 'bg-[#1d6347] dark:bg-[#f7b84b]' : 'bg-transparent'
                        }`} />
                        <span className="line-clamp-2">{item.text}</span>
                      </button>
                    )
                  })}
                </nav>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 主布局容器：Flex 居中，展开时 边栏 + 正文 作为一个整体居中；收起时 正文单栏居中 */}
      <div className="relative mx-auto flex w-full max-w-[96rem] items-start justify-center px-4 py-5 md:px-8 md:py-7">
        {/* 左侧大纲侧边栏 (Desktop xl) */}
        {tocItems.length > 0 && (
          <aside
            className={`hidden xl:block shrink-0 sticky top-24 transition-all duration-300 ease-in-out ${
              isTocExpanded ? 'w-64 xl:w-72 mr-8 opacity-100' : 'w-0 mr-0 opacity-0 overflow-hidden pointer-events-none'
            }`}
          >
            <div className="rounded-2xl border border-[#17211d]/10 bg-[#fffdf8]/90 p-5 shadow-sm backdrop-blur-md dark:border-darkBorder dark:bg-darkCard/80">
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-[#17211d]/10 dark:border-darkBorder">
                <div className="flex items-center gap-2 text-sm font-bold text-[#17211d] dark:text-foreground">
                  <ListTree size={16} className="text-[#1d6347] dark:text-[#f7b84b]" />
                  <span>{t.blog.tocTitle}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsTocExpanded(false)}
                  className="rounded-lg p-1.5 text-[#17211d]/50 hover:bg-[#17211d]/5 hover:text-[#17211d] dark:text-foreground/50 dark:hover:bg-white/5 dark:hover:text-foreground transition"
                  title={t.blog.collapseToc}
                >
                  <PanelLeftClose size={15} />
                </button>
              </div>

              {/* Reading Progress */}
              <div className="mt-3">
                <div className="flex items-center justify-between text-xs text-[#17211d]/55 dark:text-foreground/55 mb-1.5">
                  <span>{t.blog.readingProgress}</span>
                  <span className="font-semibold text-[#1d6347] dark:text-[#f7b84b]">{progress}%</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#17211d]/10 dark:bg-darkBorder">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#1d6347] to-[#b56b19] dark:from-[#f7b84b] dark:to-[#1d6347] transition-all duration-150"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              {/* TOC List */}
              <nav className="mt-4 max-h-[calc(100vh-18rem)] overflow-y-auto pr-1 space-y-1 text-xs scrollbar-thin">
                {tocItems.map((item) => {
                  const isActive = activeId === item.id
                  const indentClass =
                    item.level === 1 ? 'font-bold' : item.level === 2 ? 'pl-2.5 font-semibold' : item.level === 3 ? 'pl-5' : 'pl-7'
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleScrollTo(item.id)}
                      className={`group flex w-full items-start text-left py-1.5 px-2 rounded-lg transition-all ${indentClass} ${
                        isActive
                          ? 'bg-[#1d6347]/10 text-[#1d6347] font-semibold dark:bg-[#f7b84b]/15 dark:text-[#f7b84b]'
                          : 'text-[#17211d]/70 hover:bg-[#17211d]/5 hover:text-[#17211d] dark:text-foreground/70 dark:hover:bg-white/5 dark:hover:text-foreground'
                      }`}
                    >
                      <span
                        className={`mr-1.5 mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full transition-colors ${
                          isActive
                            ? 'bg-[#1d6347] dark:bg-[#f7b84b]'
                            : 'bg-transparent group-hover:bg-[#17211d]/20 dark:group-hover:bg-white/20'
                        }`}
                      />
                      <span className="line-clamp-2 leading-relaxed">{item.text}</span>
                    </button>
                  )
                })}
              </nav>
            </div>
          </aside>
        )}

        {/* 正文主体容器 */}
        <main className="w-full max-w-4xl shrink-0 transition-all duration-300">
          <Link
            href="/blog"
            className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-[#1d6347] transition hover:text-[#b56b19] dark:text-[#f7b84b]"
          >
            <ArrowLeft size={16} />
            {t.blog.backToBlog}
          </Link>

          <article className="overflow-hidden rounded-[2rem] border border-[#17211d]/10 bg-[#fffdf8] shadow-[0_32px_90px_-48px_rgba(23,33,29,0.6)] dark:border-darkBorder dark:bg-darkCard">
            {post.cover_url && (
              <div className="relative h-56 overflow-hidden md:h-80">
                <img
                  src={post.cover_url}
                  alt={getEnhancedAlt(post.cover_url, post.title)}
                  className="h-full w-full object-cover"
                />
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
                ref={contentRef}
                className="mt-10 border-t border-[#17211d]/10 pt-8 dark:border-darkBorder"
                data-color-mode={isDark ? 'dark' : 'light'}
              >
                <div className="prose max-w-none dark:prose-invert [&_.wmde-markdown]:!bg-transparent [&_.wmde-markdown]:!text-inherit">
                  <MDPreview source={post.content} style={{ backgroundColor: 'transparent' }} />
                </div>
              </div>

              {/* 上一篇 / 下一篇 导航卡片 */}
              {(post.prev_post || post.next_post) && (
                <nav
                  className="mt-14 grid grid-cols-1 gap-4 pt-10 border-t border-[#17211d]/10 dark:border-darkBorder sm:grid-cols-2"
                  aria-label="文章翻阅"
                >
                  {/* 上一篇 */}
                  {post.prev_post ? (
                    <Link
                      href={`/blog/${post.prev_post.slug || post.prev_post.id}`}
                      className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-[#17211d]/10 bg-[#faf8f2] p-5 transition-all duration-200 hover:-translate-y-1 hover:border-[#1d6347]/40 hover:shadow-md dark:border-darkBorder dark:bg-darkCard/70 dark:hover:border-[#f7b84b]/40"
                    >
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-[#1d6347] dark:text-[#f7b84b]">
                        <ChevronLeft
                          size={14}
                          className="transition-transform group-hover:-translate-x-1"
                        />
                        <span>{t.blog.prevPost}</span>
                      </div>
                      <h3 className="mt-3 text-sm font-bold text-[#17211d] line-clamp-2 group-hover:text-[#1d6347] dark:text-foreground dark:group-hover:text-[#f7b84b] md:text-base">
                        {post.prev_post.title}
                      </h3>
                      {post.prev_post.published_at && (
                        <span className="mt-3 text-xs text-[#17211d]/45 dark:text-foreground/45">
                          {formatDate(post.prev_post.published_at)}
                        </span>
                      )}
                    </Link>
                  ) : (
                    <div className="flex flex-col justify-between rounded-2xl border border-dashed border-[#17211d]/15 bg-transparent p-5 opacity-40 dark:border-darkBorder">
                      <span className="text-xs font-semibold text-[#17211d]/50 dark:text-foreground/50">
                        {t.blog.noPrevPost}
                      </span>
                      <span className="mt-3 text-sm text-[#17211d]/40 dark:text-foreground/40">
                        {t.blog.noPrevPost}
                      </span>
                    </div>
                  )}

                  {/* 下一篇 */}
                  {post.next_post ? (
                    <Link
                      href={`/blog/${post.next_post.slug || post.next_post.id}`}
                      className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-[#17211d]/10 bg-[#faf8f2] p-5 text-right transition-all duration-200 hover:-translate-y-1 hover:border-[#1d6347]/40 hover:shadow-md dark:border-darkBorder dark:bg-darkCard/70 dark:hover:border-[#f7b84b]/40"
                    >
                      <div className="flex items-center justify-end gap-1.5 text-xs font-semibold text-[#1d6347] dark:text-[#f7b84b]">
                        <span>{t.blog.nextPost}</span>
                        <ChevronRight
                          size={14}
                          className="transition-transform group-hover:translate-x-1"
                        />
                      </div>
                      <h3 className="mt-3 text-sm font-bold text-[#17211d] line-clamp-2 group-hover:text-[#1d6347] dark:text-foreground dark:group-hover:text-[#f7b84b] md:text-base">
                        {post.next_post.title}
                      </h3>
                      {post.next_post.published_at && (
                        <span className="mt-3 text-xs text-[#17211d]/45 dark:text-foreground/45">
                          {formatDate(post.next_post.published_at)}
                        </span>
                      )}
                    </Link>
                  ) : (
                    <div className="flex flex-col justify-between rounded-2xl border border-dashed border-[#17211d]/15 bg-transparent p-5 text-right opacity-40 dark:border-darkBorder">
                      <span className="text-xs font-semibold text-[#17211d]/50 dark:text-foreground/50">
                        {t.blog.noNextPost}
                      </span>
                      <span className="mt-3 text-sm text-[#17211d]/40 dark:text-foreground/40">
                        {t.blog.noNextPost}
                      </span>
                    </div>
                  )}
                </nav>
              )}
            </div>
          </article>
        </main>
      </div>

      <footer className="relative border-t border-[#17211d]/10 bg-[#eef1eb]/70 py-8 text-center dark:border-darkBorder dark:bg-darkBg/70">
        <p className="flex items-center justify-center gap-1 text-xs text-[#17211d]/45 dark:text-foreground/45">
          <BookOpen size={12} className="text-[#b56b19]" />
          {t.blog.footerPost}
        </p>
      </footer>
    </div>
  )
}
