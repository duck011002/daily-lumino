'use client'

import { FormEvent, Suspense, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  ArrowUpRight,
  BookOpen,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Eye,
  Loader2,
  Search,
  Settings2,
  Sparkles,
  Tag,
  User,
  X,
} from 'lucide-react'
import SiteNav from '@/components/layout/SiteNav'
import { publicApi } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { useLanguage } from '@/hooks/useLanguage'

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
  is_featured: boolean
  view_count: number
  published_at: string | null
  created_at: string
  category: BlogCategory | null
}

interface BlogPageResponse {
  items: BlogPost[]
  total: number
  page: number
  page_size: number
  pages: number
}

const emptyPage: BlogPageResponse = {
  items: [],
  total: 0,
  page: 1,
  page_size: 9,
  pages: 1,
}

export default function PublicBlogListPage() {
  return (
    <Suspense
      fallback={
        <div className="grid min-h-screen place-items-center bg-[#f6f4ee] dark:bg-darkBg">
          <Loader2 className="h-8 w-8 animate-spin text-[#b56b19]" />
        </div>
      }
    >
      <PublicBlogList />
    </Suspense>
  )
}

function PublicBlogList() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useAuth()
  const { t, formatDate } = useLanguage()
  const activeCategory = searchParams.get('category') || 'all'
  const query = (searchParams.get('q') || '').trim()
  const rawPage = Number.parseInt(searchParams.get('page') || '1', 10)
  const currentPage = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1

  const [categories, setCategories] = useState<BlogCategory[]>([])
  const [pageData, setPageData] = useState<BlogPageResponse>(emptyPage)
  const [featuredPosts, setFeaturedPosts] = useState<BlogPost[]>([])
  const [searchInput, setSearchInput] = useState(query)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    publicApi
      .get('/blog/categories', { signal: controller.signal })
      .then((response) => setCategories(response.data))
      .catch((error) => {
        if (error.code !== 'ERR_CANCELED') setCategories([])
      })
    return () => controller.abort()
  }, [])

  useEffect(() => {
    setSearchInput(query)
  }, [query])

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError('')

    publicApi
      .get('/blog/posts-page', {
        signal: controller.signal,
        params: {
          category: activeCategory === 'all' ? undefined : activeCategory,
          q: query || undefined,
          page: currentPage,
          page_size: 9,
        },
      })
      .then((response) => {
        setPageData(response.data)
      })
      .catch((requestError: any) => {
        if (requestError.code === 'ERR_CANCELED') return
        setPageData(emptyPage)
        setError(requestError.response?.data?.detail || t.common.loadFailed)
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [activeCategory, currentPage, query, t.common.loadFailed])

  useEffect(() => {
    const controller = new AbortController()
    if (query || currentPage !== 1) {
      setFeaturedPosts([])
      return
    }
    const categoryQuery =
      activeCategory === 'all' ? '' : `?category=${encodeURIComponent(activeCategory)}`
    publicApi
      .get(`/blog/featured${categoryQuery}`, { signal: controller.signal })
      .then((response) => {
        setFeaturedPosts(response.data)
      })
      .catch((error) => {
        if (error.code !== 'ERR_CANCELED') setFeaturedPosts([])
      })
    return () => controller.abort()
  }, [activeCategory, currentPage, query])

  const categoryName =
    activeCategory === 'all'
      ? t.blog.allPosts
      : categories.find((item) => item.slug === activeCategory)?.name || activeCategory
  const canWrite = Boolean(user?.is_root || user?.can_write_blog)
  const heroPost = featuredPosts[0]
  const secondaryFeaturedPosts = featuredPosts.slice(1, 4)
  const pageItems = useMemo(
    () => buildPageItems(currentPage, pageData.pages),
    [currentPage, pageData.pages]
  )

  const updateRoute = (category: string, search: string, page: number) => {
    const params = new URLSearchParams()
    if (category !== 'all') params.set('category', category)
    if (search.trim()) params.set('q', search.trim())
    if (page > 1) params.set('page', String(page))
    const suffix = params.toString()
    router.push(suffix ? `/blog?${suffix}` : '/blog', { scroll: false })
  }

  const handleSearch = (event: FormEvent) => {
    event.preventDefault()
    updateRoute(activeCategory, searchInput, 1)
  }

  const changePage = (page: number) => {
    updateRoute(activeCategory, query, page)
    window.setTimeout(() => {
      document.getElementById('article-index')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
    }, 50)
  }

  return (
    <div className="min-h-screen bg-[#f6f4ee] text-[#17211d] dark:bg-darkBg dark:text-foreground">
      <SiteNav />

      <main className="mx-auto max-w-6xl px-5 pb-20 pt-8 md:px-8 md:pt-12">
        <section className="relative overflow-hidden rounded-[2rem] bg-[#163a2b] px-7 py-10 text-white shadow-[0_28px_80px_-46px_rgba(22,58,43,0.9)] md:px-10 md:py-12">
          <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full border-[34px] border-[#f7b84b]/16" />
          <div className="relative flex flex-col gap-7 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.26em] text-[#f7b84b]">
                {t.blog.heroBadge}
              </p>
              <h1 className="mt-4 font-display text-4xl font-bold md:text-5xl">
                {t.blog.heroTitle}
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-white/66">
                {t.blog.heroDesc}
              </p>
            </div>
            {canWrite && (
              <Link
                href="/blog/manage"
                className="inline-flex w-fit items-center gap-2 rounded-full bg-[#f7b84b] px-4 py-2.5 text-sm font-bold text-[#17211d] transition hover:bg-[#ffc963]"
              >
                <Settings2 size={15} />
                {t.blog.manageArticles}
              </Link>
            )}
          </div>
        </section>

        <section className="mt-8 rounded-[1.8rem] border border-[#17211d]/10 bg-white/60 p-5 dark:border-darkBorder dark:bg-darkCard/60">
          <div className="flex gap-2 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => updateRoute('all', query, 1)}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition ${
                activeCategory === 'all'
                  ? 'bg-[#163a2b] text-white'
                  : 'border border-[#17211d]/12 bg-[#fffdf8] text-[#17211d]/65 hover:border-[#163a2b]/40 dark:border-darkBorder dark:bg-darkBg dark:text-foreground/65'
              }`}
            >
              {t.blog.allPosts}
            </button>
            {categories.map((category) => (
              <button
                key={category.id}
                type="button"
                onClick={() => updateRoute(category.slug, query, 1)}
                className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition ${
                  activeCategory === category.slug
                    ? 'bg-[#163a2b] text-white'
                    : 'border border-[#17211d]/12 bg-[#fffdf8] text-[#17211d]/65 hover:border-[#163a2b]/40 dark:border-darkBorder dark:bg-darkBg dark:text-foreground/65'
                }`}
              >
                {category.name}
              </button>
            ))}
          </div>

          <form onSubmit={handleSearch} className="mt-4 flex flex-col gap-2 sm:flex-row">
            <label className="relative flex-1">
              <Search
                size={16}
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#17211d]/35 dark:text-foreground/35"
              />
              <input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder={
                  activeCategory === 'all'
                    ? t.blog.searchAll
                    : t.blog.searchInTopic.replace('{topic}', categoryName)
                }
                className="w-full rounded-full border border-[#17211d]/12 bg-[#fffdf8] py-3 pl-11 pr-11 text-sm outline-none transition focus:border-[#1d6347]/50 focus:ring-2 focus:ring-[#1d6347]/10 dark:border-darkBorder dark:bg-darkBg"
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchInput('')
                    if (query) updateRoute(activeCategory, '', 1)
                  }}
                  className="absolute right-3 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full text-[#17211d]/35 hover:bg-[#17211d]/5 hover:text-[#17211d] dark:text-foreground/35"
                  title={t.blog.clearSearch}
                >
                  <X size={14} />
                </button>
              )}
            </label>
            <button
              type="submit"
              className="rounded-full bg-[#163a2b] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#24553f]"
            >
              {t.blog.searchBtn}
            </button>
          </form>
          <p className="mt-3 text-xs text-[#17211d]/42 dark:text-foreground/42">
            {t.blog.currentScope}
            {categoryName}
            {query ? t.blog.keyword.replace('{kw}', query) : t.blog.byDate}
          </p>
        </section>

        {!query && currentPage === 1 && heroPost && (
          <section className="mt-9">
            <div className="flex items-end justify-between border-b border-[#17211d]/10 pb-4 dark:border-darkBorder">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#b56b19]">
                  {t.blog.featuredShelf}
                </p>
                <h2 className="mt-1 font-display text-2xl font-bold">{t.blog.featuredShelfTitle}</h2>
              </div>
              <span className="text-xs text-[#17211d]/42 dark:text-foreground/42">
                {t.blog.maxPosts}
              </span>
            </div>

            <div className="mt-5 grid gap-5 lg:grid-cols-[1.28fr_0.72fr]">
              <Link
                href={`/blog/${heroPost.slug}`}
                className="group grid min-h-[21rem] overflow-hidden rounded-[2rem] border border-[#17211d]/10 bg-[#fffdf8] shadow-[0_24px_70px_-46px_rgba(23,33,29,0.65)] transition hover:-translate-y-1 dark:border-darkBorder dark:bg-darkCard md:grid-cols-[1.1fr_0.9fr]"
              >
                <div className="relative min-h-56 overflow-hidden bg-[#dce9df] dark:bg-[#173126]">
                  {heroPost.cover_url ? (
                    <img
                      src={heroPost.cover_url}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_20%,#f7b84b_0,transparent_27%),linear-gradient(135deg,#1e513b,#0b2118)]" />
                  )}
                  <span className="absolute bottom-5 left-5 rounded-full bg-[#f7b84b] px-3 py-1 text-xs font-bold text-[#17211d]">
                    {t.blog.featuredBadge}
                  </span>
                </div>
                <div className="flex flex-col justify-between p-7">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.15em] text-[#b56b19]">
                      {heroPost.category?.name || t.blog.uncategorized}
                    </p>
                    <h3 className="mt-4 font-display text-2xl font-bold leading-tight group-hover:text-[#1d6347] dark:group-hover:text-[#f7b84b]">
                      {heroPost.title}
                    </h3>
                    <p className="mt-3 line-clamp-3 text-sm leading-6 text-[#17211d]/58 dark:text-foreground/58">
                      {heroPost.excerpt || t.blog.defaultExcerpt}
                    </p>
                  </div>
                  <div className="mt-6 flex items-center justify-between text-xs font-semibold text-[#17211d]/45 dark:text-foreground/45">
                    <span className="flex items-center gap-1.5">
                      <Calendar size={13} />
                      {formatDate(heroPost.published_at)}
                    </span>
                    <ArrowUpRight size={16} className="text-[#1d6347] dark:text-[#f7b84b]" />
                  </div>
                </div>
              </Link>

              <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
                {secondaryFeaturedPosts.map((post, index) => (
                  <FeaturedMiniCard key={post.id} post={post} rank={index + 2} />
                ))}
              </div>
            </div>
          </section>
        )}

        <section id="article-index" className="scroll-mt-28 pt-10">
          <div className="flex flex-col gap-2 border-b border-[#17211d]/10 pb-4 dark:border-darkBorder sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#b56b19]">
                {query ? 'Search results' : 'Latest writing'}
              </p>
              <h2 className="mt-1 font-display text-2xl font-bold">
                {query
                  ? t.blog.searchResultsTitle.replace('{query}', query)
                  : activeCategory === 'all'
                    ? t.blog.latestWriting
                    : `${categoryName} · ${t.blog.allPosts}`}
              </h2>
            </div>
            {!loading && (
              <p className="text-sm text-[#17211d]/45 dark:text-foreground/45">
                {featuredPosts.length && !query
                  ? t.blog.extraCount.replace('{count}', String(pageData.total))
                  : t.blog.foundCount.replace('{count}', String(pageData.total))}
              </p>
            )}
          </div>

          {loading ? (
            <div className="grid min-h-72 place-items-center">
              <Loader2 className="h-8 w-8 animate-spin text-[#b56b19]" />
            </div>
          ) : error ? (
            <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-600 dark:border-red-500/30 dark:bg-red-500/10">
              {error}
            </div>
          ) : pageData.items.length === 0 ? (
            <div className="mt-6 rounded-[2rem] border border-dashed border-[#17211d]/18 bg-white/45 px-6 py-16 text-center dark:border-darkBorder dark:bg-darkCard/30">
              <BookOpen className="mx-auto h-8 w-8 text-[#b56b19]" />
              <h3 className="mt-4 font-display text-xl font-bold">
                {query ? t.blog.emptySearchTitle : t.blog.emptyCategoryTitle}
              </h3>
              <p className="mx-auto mt-2 max-w-md text-sm text-[#17211d]/50 dark:text-foreground/50">
                {query ? t.blog.emptySearchDesc : t.blog.emptyCategoryDesc}
              </p>
            </div>
          ) : (
            <div className="mt-6 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {pageData.items.map((post) => (
                <ArticleCard key={post.id} post={post} />
              ))}
            </div>
          )}

          {!loading && pageData.pages > 1 && (
            <nav className="mt-10 flex flex-wrap items-center justify-center gap-2" aria-label="文章分页">
              <button
                type="button"
                onClick={() => changePage(Math.max(1, currentPage - 1))}
                disabled={currentPage <= 1}
                className="inline-flex h-10 items-center gap-1 rounded-full border border-[#17211d]/12 bg-[#fffdf8] px-4 text-sm font-semibold transition hover:border-[#163a2b]/35 disabled:cursor-not-allowed disabled:opacity-35 dark:border-darkBorder dark:bg-darkCard"
              >
                <ChevronLeft size={15} />
                {t.blog.prevPage}
              </button>
              {pageItems.map((item, index) =>
                item === 'ellipsis' ? (
                  <span key={`ellipsis-${index}`} className="grid h-10 w-8 place-items-center text-[#17211d]/35 dark:text-foreground/35">
                    …
                  </span>
                ) : (
                  <button
                    key={item}
                    type="button"
                    onClick={() => changePage(item)}
                    className={`grid h-10 w-10 place-items-center rounded-full text-sm font-bold transition ${
                      item === currentPage
                        ? 'bg-[#163a2b] text-white'
                        : 'border border-[#17211d]/12 bg-[#fffdf8] hover:border-[#163a2b]/35 dark:border-darkBorder dark:bg-darkCard'
                    }`}
                    aria-current={item === currentPage ? 'page' : undefined}
                  >
                    {item}
                  </button>
                )
              )}
              <button
                type="button"
                onClick={() => changePage(Math.min(pageData.pages, currentPage + 1))}
                disabled={currentPage >= pageData.pages}
                className="inline-flex h-10 items-center gap-1 rounded-full border border-[#17211d]/12 bg-[#fffdf8] px-4 text-sm font-semibold transition hover:border-[#163a2b]/35 disabled:cursor-not-allowed disabled:opacity-35 dark:border-darkBorder dark:bg-darkCard"
              >
                {t.blog.nextPage}
                <ChevronRight size={15} />
              </button>
            </nav>
          )}
        </section>
      </main>
    </div>
  )
}

function buildPageItems(page: number, pages: number): Array<number | 'ellipsis'> {
  if (pages <= 7) return Array.from({ length: pages }, (_, index) => index + 1)
  const items: Array<number | 'ellipsis'> = [1]
  if (page > 4) items.push('ellipsis')
  const start = Math.max(2, page - 1)
  const end = Math.min(pages - 1, page + 1)
  for (let value = start; value <= end; value += 1) items.push(value)
  if (page < pages - 3) items.push('ellipsis')
  items.push(pages)
  return items
}

function FeaturedMiniCard({ post, rank }: { post: BlogPost; rank: number }) {
  const { t } = useLanguage()
  return (
    <Link
      href={`/blog/${post.slug}`}
      className="group relative flex min-h-28 flex-col overflow-hidden rounded-3xl border border-[#17211d]/10 bg-[#fffdf8] p-5 transition hover:-translate-y-0.5 hover:border-[#1d6347]/45 hover:shadow-lg dark:border-darkBorder dark:bg-darkCard"
    >
      {post.cover_url && (
        <img
          src={post.cover_url}
          alt=""
          loading="lazy"
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover opacity-[0.05] transition duration-500 group-hover:scale-105 group-hover:opacity-[0.1]"
        />
      )}
      <div className="relative flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#b56b19]">
          <Sparkles size={12} />
          {t.blog.featuredRank.replace('{rank}', String(rank).padStart(2, '0'))}
        </span>
        <ArrowUpRight size={14} className="text-[#1d6347] dark:text-[#f7b84b]" />
      </div>
      <h3 className="relative mt-2 line-clamp-2 font-display text-base font-bold leading-snug group-hover:text-[#1d6347] dark:group-hover:text-[#f7b84b]">
        {post.title}
      </h3>
    </Link>
  )
}

function ArticleCard({ post }: { post: BlogPost }) {
  const { t } = useLanguage()
  return (
    <Link
      href={`/blog/${post.slug}`}
      className="group flex min-h-64 flex-col rounded-3xl border border-[#17211d]/10 bg-[#fffdf8] p-6 transition hover:-translate-y-1 hover:border-[#1d6347]/45 hover:shadow-xl dark:border-darkBorder dark:bg-darkCard"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-[0.13em] text-[#b56b19]">
          {post.category?.name || t.blog.uncategorized}
        </span>
        <ChevronRight
          size={18}
          className="text-[#17211d]/30 transition group-hover:translate-x-1 group-hover:text-[#1d6347] dark:text-foreground/30"
        />
      </div>
      <h3 className="mt-5 font-display text-xl font-bold leading-snug group-hover:text-[#1d6347] dark:group-hover:text-[#f7b84b]">
        {post.title}
      </h3>
      <p className="mt-3 line-clamp-3 text-sm leading-6 text-[#17211d]/58 dark:text-foreground/58">
        {post.excerpt || t.blog.openToRead}
      </p>
      <div className="mt-auto pt-6">
        <div className="flex flex-wrap gap-1.5">
          {post.tags?.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded-md bg-[#f1eee5] px-2 py-1 text-[11px] text-[#17211d]/60 dark:bg-darkBg dark:text-foreground/60"
            >
              <Tag size={10} />
              {tag}
            </span>
          ))}
        </div>
        <div className="mt-4 flex items-center justify-between text-xs text-[#17211d]/42 dark:text-foreground/42">
          <span className="flex items-center gap-1">
            <User size={12} />
            {t.blog.editorialTeam}
          </span>
          <span className="flex items-center gap-1">
            <Eye size={12} />
            {post.view_count}
          </span>
        </div>
      </div>
    </Link>
  )
}
