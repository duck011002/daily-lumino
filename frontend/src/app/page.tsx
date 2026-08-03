'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Calendar,
  Clapperboard,
  DoorOpen,
  ExternalLink,
  Github,
  Headphones,
  Library,
  Mail,
  Newspaper,
  Sparkles,
} from 'lucide-react'
import SiteNav from '@/components/layout/SiteNav'
import api from '@/lib/api'
import { defaultSiteProfile, SiteMediaCard, SiteProfile } from '@/lib/siteProfile'

interface FeaturedPost {
  id: number
  title: string
  slug: string
  excerpt: string | null
  cover_url: string | null
  published_at: string | null
  view_count: number
  category: { name: string } | null
}

const formatDate = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat('zh-CN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }).format(new Date(value))
    : '近期发布'

const mediaMeta = {
  book: { label: '书籍', icon: BookOpen },
  movie: { label: '影视', icon: Clapperboard },
  music: { label: '音乐', icon: Headphones },
  status: { label: '生活收藏', icon: Sparkles },
  other: { label: '其他收藏', icon: Sparkles },
}

const destinations = [
  {
    label: '书房',
    meaning: '关于我与收藏',
    href: '/library',
    icon: Library,
  },
  {
    label: '博客',
    meaning: '文章与技术实践',
    href: '/blog',
    icon: Newspaper,
  },
  {
    label: '内院',
    meaning: '登录后的私人空间',
    href: '/courtyard',
    icon: DoorOpen,
  },
]

export default function Home() {
  const [profile, setProfile] = useState<SiteProfile>(defaultSiteProfile)
  const [featuredPosts, setFeaturedPosts] = useState<FeaturedPost[]>([])

  useEffect(() => {
    Promise.allSettled([api.get('/site/profile'), api.get('/blog/featured')]).then(
      ([profileResult, featuredResult]) => {
        if (profileResult.status === 'fulfilled') setProfile(profileResult.value.data)
        if (featuredResult.status === 'fulfilled') setFeaturedPosts(featuredResult.value.data)
      }
    )
  }, [])

  const heroPost = featuredPosts[0]
  const secondaryPosts = featuredPosts.slice(1, 4)
  const explicitlyFeatured = profile.media_cards.filter((item) => item.is_featured)
  const favoritePreview = explicitlyFeatured.length > 0
    ? explicitlyFeatured.slice(0, 3)
    : (['book', 'movie', 'music'] as const)
        .map((category) => profile.media_cards.find((item) => item.category === category))
        .filter(Boolean) as SiteMediaCard[]
  const publicLinks = [
    profile.github_url
      ? { id: 'github', label: 'GitHub', url: profile.github_url, icon: Github }
      : null,
    profile.email && profile.show_email
      ? { id: 'email', label: profile.email, url: `mailto:${profile.email}`, icon: Mail }
      : null,
    ...profile.links.map((item) => ({
      id: item.id,
      label: item.label,
      url: item.url,
      icon: ExternalLink,
    })),
  ].filter(Boolean) as Array<{
    id: string
    label: string
    url: string
    icon: typeof Github
  }>

  return (
    <div className="min-h-screen bg-[#f8f6f0] text-[#17211d] dark:bg-darkBg dark:text-foreground">
      <SiteNav />

      <main className="mx-auto max-w-7xl px-5 pb-20 pt-8 md:px-8 md:pt-12">
        <section className="grid gap-5 lg:grid-cols-[1.42fr_0.58fr]">
          <div className="relative min-h-[30rem] overflow-hidden rounded-[2.2rem] bg-[#163a2b] p-7 text-white shadow-[0_35px_100px_-55px_rgba(22,58,43,0.95)] md:p-11">
            {profile.cover_url ? (
              <img
                src={profile.cover_url}
                alt=""
                className="absolute inset-0 h-full w-full object-cover opacity-35"
              />
            ) : (
              <>
                <div className="absolute -right-20 -top-24 h-80 w-80 rounded-full border-[46px] border-[#f7b84b]/16" />
                <div className="absolute -bottom-20 left-1/4 h-52 w-96 rotate-12 rounded-full bg-[#f7b84b]/10 blur-3xl" />
              </>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-[#0b2118]/95 via-[#163a2b]/55 to-[#163a2b]/20" />

            <div className="relative flex h-full min-h-[24rem] flex-col">
              <div className="flex items-center justify-between gap-4">
                <p className="text-xs font-bold uppercase tracking-[0.28em] text-[#f7b84b]">
                  Welcome to my digital garden
                </p>
                <span className="hidden rounded-full border border-white/14 bg-white/[0.06] px-3 py-1.5 text-[10px] font-bold tracking-[0.12em] text-white/58 sm:block">
                  前厅 · 网站主页
                </span>
              </div>

              <div className="mt-auto">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-end">
                  <div className="grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-[1.7rem] border border-white/20 bg-white/10 font-display text-4xl font-bold text-[#f7b84b] shadow-2xl">
                    {profile.avatar_url ? (
                      <img
                        src={profile.avatar_url}
                        alt={profile.display_name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      profile.display_name.slice(0, 1).toUpperCase()
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white/55">你好，我是</p>
                    <h1 className="mt-1 font-display text-4xl font-bold leading-none md:text-6xl">
                      {profile.display_name}
                    </h1>
                  </div>
                </div>

                <h2 className="mt-7 max-w-3xl font-display text-2xl font-semibold leading-tight text-white/95 md:text-3xl">
                  {profile.headline}
                </h2>
                <p className="mt-4 line-clamp-3 max-w-3xl whitespace-pre-line text-sm leading-7 text-white/68 md:text-base">
                  {profile.bio}
                </p>

                {profile.interest_tags.length > 0 && (
                  <div className="mt-6 flex flex-wrap gap-2">
                    {profile.interest_tags.slice(0, 6).map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full border border-white/16 bg-white/8 px-3 py-1.5 text-xs font-semibold text-white/78"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                <div className="mt-7 border-t border-white/12 pt-5">
                  <p className="text-[11px] font-semibold text-white/48">
                    从前厅继续认识这座庭院
                  </p>
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-x-6 sm:gap-y-3">
                    {destinations.map((item) => (
                      <Link
                        key={item.label}
                        href={item.href}
                        className="group inline-flex items-center gap-2 text-sm transition"
                      >
                        <item.icon size={14} className="text-[#f7b84b]" />
                        <span className="font-bold text-white">{item.label}</span>
                        <span className="text-white/48">· {item.meaning}</span>
                        <ArrowRight
                          size={13}
                          className="text-white/30 transition group-hover:translate-x-1 group-hover:text-[#f7b84b]"
                        />
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-5">
            <div className="rounded-[2rem] border border-[#17211d]/10 bg-[#fffdf8] p-7 shadow-[0_24px_70px_-50px_rgba(23,33,29,0.65)] dark:border-darkBorder dark:bg-darkCard">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#b56b19]">
                  About this place
                </p>
                <Sparkles size={18} className="text-[#f0a537]" />
              </div>
              <h2 className="mt-4 font-display text-2xl font-bold">一座开放的前厅</h2>
              <p className="mt-3 text-sm leading-7 text-[#17211d]/58 dark:text-foreground/58">
                更完整的个人介绍与收藏在书房，公开文章在博客；登录之后，内院才会为你打开。
              </p>
              <Link
                href="/library"
                className="group mt-5 inline-flex items-center gap-2 text-sm font-bold text-[#1d6347] dark:text-[#f7b84b]"
              >
                走进书房
                <ArrowRight size={15} className="transition group-hover:translate-x-1" />
              </Link>
              {profile.status_text && profile.status_public && (
                <div className="mt-5 rounded-2xl bg-[#edf2e9] px-4 py-3 dark:bg-[#163a2b]/45">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#1d6347] dark:text-[#f7b84b]">
                    此刻
                  </p>
                  <p className="mt-1 text-sm font-semibold leading-6">{profile.status_text}</p>
                </div>
              )}
            </div>

            <div className="rounded-[2rem] border border-[#17211d]/10 bg-white/65 p-7 dark:border-darkBorder dark:bg-darkCard/70">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#b56b19]">
                Find me
              </p>
              {publicLinks.length > 0 ? (
                <div className="mt-4 grid gap-2">
                  {publicLinks.slice(0, 4).map((item) => (
                    <a
                      key={item.id}
                      href={item.url}
                      target={item.url.startsWith('http') ? '_blank' : undefined}
                      rel={item.url.startsWith('http') ? 'noreferrer' : undefined}
                      className="group flex items-center justify-between rounded-2xl border border-[#17211d]/8 bg-[#fffdf8] px-4 py-3 text-sm font-semibold transition hover:border-[#1d6347]/35 hover:text-[#1d6347] dark:border-darkBorder dark:bg-darkBg"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <item.icon size={15} className="shrink-0 text-[#b56b19]" />
                        <span className="truncate">{item.label}</span>
                      </span>
                      <ArrowUpRight
                        size={15}
                        className="shrink-0 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                      />
                    </a>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-sm leading-6 text-[#17211d]/45 dark:text-foreground/45">
                  联系方式正在整理，稍后再来看看。
                </p>
              )}
            </div>
          </div>
        </section>

        {favoritePreview.length > 0 && (
          <section className="mt-14">
            <SectionHeading
              eyebrow="From my shelves"
              title="最近想与你分享"
              description="这里只放几件，完整收藏都在书房。"
              action={{ label: '进入书房', href: '/library' }}
            />
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {favoritePreview.map((item) => (
                <FavoritePreviewCard key={item.id} item={item} />
              ))}
            </div>
          </section>
        )}

        <section className="mt-14">
          <SectionHeading
            eyebrow="Selected writing"
            title="博客精选"
            description="从不同技术分区中挑出的近期文章。"
            action={{ label: '查看全部文章', href: '/blog' }}
          />

          {featuredPosts.length > 0 ? (
            <div className="mt-6 grid gap-4 lg:grid-cols-[1.35fr_0.65fr]">
              {heroPost && (
                <Link
                  href={`/blog/${heroPost.slug}`}
                  className="group relative flex min-h-[21rem] overflow-hidden rounded-[2rem] bg-[#163a2b] p-7 text-white shadow-[0_28px_75px_-45px_rgba(22,58,43,0.95)] transition hover:-translate-y-1 md:p-8"
                >
                  {heroPost.cover_url ? (
                    <img
                      src={heroPost.cover_url}
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-105"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(247,184,75,0.45),transparent_28%),linear-gradient(135deg,#1e513b,#0b2118)]" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0b2118] via-[#0b2118]/58 to-transparent" />
                  <div className="relative mt-auto max-w-2xl">
                    <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
                      <span className="rounded-full bg-[#f7b84b] px-3 py-1 text-[#17211d]">
                        精选阅读
                      </span>
                      <span className="rounded-full border border-white/25 bg-white/10 px-3 py-1 text-white/85">
                        {heroPost.category?.name || '技术实践'}
                      </span>
                    </div>
                    <h3 className="mt-4 font-display text-2xl font-bold leading-tight md:text-3xl">
                      {heroPost.title}
                    </h3>
                    <p className="mt-3 line-clamp-2 text-sm leading-6 text-white/68">
                      {heroPost.excerpt || '打开文章，查看完整的实践记录与实现细节。'}
                    </p>
                    <div className="mt-5 flex items-center justify-between text-xs font-semibold text-white/65">
                      <span className="flex items-center gap-1.5">
                        <Calendar size={13} />
                        {formatDate(heroPost.published_at)}
                      </span>
                      <span className="flex items-center gap-1 text-[#f7b84b]">
                        阅读全文 <ArrowUpRight size={16} />
                      </span>
                    </div>
                  </div>
                </Link>
              )}

              <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
                {secondaryPosts.map((post, index) => (
                  <Link
                    key={post.id}
                    href={`/blog/${post.slug}`}
                    className="group relative flex min-h-28 flex-col overflow-hidden rounded-3xl border border-[#17211d]/10 bg-[#fffdf8] p-5 transition hover:-translate-y-0.5 hover:border-[#1d6347]/40 hover:shadow-lg dark:border-darkBorder dark:bg-darkCard"
                  >
                    {post.cover_url && (
                      <img
                        src={post.cover_url}
                        alt=""
                        className="absolute inset-0 h-full w-full object-cover opacity-[0.055] transition duration-500 group-hover:scale-105 group-hover:opacity-[0.1]"
                      />
                    )}
                    <div className="relative flex items-center justify-between gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#b56b19]">
                        {String(index + 2).padStart(2, '0')} ·{' '}
                        {post.category?.name || '技术实践'}
                      </span>
                      <ArrowUpRight size={14} className="text-[#1d6347]" />
                    </div>
                    <h3 className="relative mt-2 line-clamp-2 font-display text-base font-bold leading-snug">
                      {post.title}
                    </h3>
                  </Link>
                ))}
              </div>
            </div>
          ) : (
            <div className="mt-6 rounded-3xl border border-dashed border-[#17211d]/15 bg-white/45 px-6 py-10 text-center dark:border-darkBorder dark:bg-darkCard/30">
              <p className="font-display text-lg font-bold">精选内容正在整理</p>
              <p className="mt-2 text-sm text-[#17211d]/50 dark:text-foreground/50">
                新的技术实践会在完成整理后出现在这里。
              </p>
            </div>
          )}
        </section>
      </main>

      <footer className="border-t border-[#17211d]/10 py-8 text-center text-xs text-[#17211d]/42 dark:border-darkBorder dark:text-foreground/42">
        © {new Date().getFullYear()} Lumino · 一座持续生长的个人数字庭院
      </footer>
    </div>
  )
}

function SectionHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string
  title: string
  description: string
  action?: { label: string; href: string }
}) {
  return (
    <div className="flex flex-col gap-4 border-b border-[#17211d]/10 pb-5 dark:border-darkBorder sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#b56b19]">{eyebrow}</p>
        <h2 className="mt-2 font-display text-2xl font-bold md:text-3xl">{title}</h2>
        <p className="mt-2 text-sm text-[#17211d]/48 dark:text-foreground/48">
          {description}
        </p>
      </div>
      {action && (
        <Link
          href={action.href}
          className="group inline-flex w-fit shrink-0 items-center gap-2 text-sm font-bold text-[#1d6347] dark:text-[#f7b84b]"
        >
          {action.label}
          <ArrowRight size={15} className="transition group-hover:translate-x-1" />
        </Link>
      )}
    </div>
  )
}

function FavoritePreviewCard({ item }: { item: SiteMediaCard }) {
  const meta = mediaMeta[item.category]
  const creator = item.creator || item.subtitle
  const byline = [creator, item.year].filter(Boolean).join(' · ')

  return (
    <article className="group flex min-h-44 gap-4 overflow-hidden rounded-[1.7rem] border border-[#17211d]/10 bg-[#fffdf8] p-4 transition hover:-translate-y-0.5 hover:border-[#1d6347]/30 hover:shadow-lg dark:border-darkBorder dark:bg-darkCard">
      <div className="h-36 w-24 shrink-0 overflow-hidden rounded-2xl bg-gradient-to-br from-[#e7efe8] to-[#f7edd9] dark:from-[#163a2b] dark:to-[#2e2518]">
        {item.image_url ? (
          <img
            src={item.image_url}
            alt={item.title}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="grid h-full place-items-center">
            <meta.icon size={25} className="text-[#b56b19]" />
          </div>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col py-1">
        <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[#b56b19]">
          <meta.icon size={11} />
          {item.badge || meta.label}
        </p>
        <h3 className="mt-3 line-clamp-2 font-display text-lg font-bold leading-snug">
          {item.title}
        </h3>
        {byline && (
          <p className="mt-1 truncate text-xs font-semibold text-[#17211d]/45 dark:text-foreground/45">
            {byline}
          </p>
        )}
        {item.note && (
          <p className="mt-3 line-clamp-2 text-xs leading-5 text-[#17211d]/55 dark:text-foreground/55">
            {item.note}
          </p>
        )}
      </div>
    </article>
  )
}
