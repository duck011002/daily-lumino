'use client'

import { useEffect, useMemo, useState } from 'react'
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
import { useLanguage } from '@/hooks/useLanguage'

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

const mediaMetaIcons = {
  book: BookOpen,
  movie: Clapperboard,
  music: Headphones,
  status: Sparkles,
  other: Sparkles,
}

export default function Home() {
  const { t, formatDate } = useLanguage()
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

  const destinations = useMemo(
    () => [
      {
        label: t.home.destinations.library.label,
        meaning: t.home.destinations.library.meaning,
        href: '/library',
        icon: Library,
      },
      {
        label: t.home.destinations.blog.label,
        meaning: t.home.destinations.blog.meaning,
        href: '/blog',
        icon: Newspaper,
      },
      {
        label: t.home.destinations.courtyard.label,
        meaning: t.home.destinations.courtyard.meaning,
        href: '/courtyard',
        icon: DoorOpen,
      },
    ],
    [t]
  )

  const heroPost = featuredPosts[0]
  const secondaryPosts = featuredPosts.slice(1, 4)
  const explicitlyFeatured = profile.media_cards.filter((item) => item.is_featured)
  const favoritePreview =
    explicitlyFeatured.length > 0
      ? explicitlyFeatured
      : ((['book', 'movie', 'music'] as const)
          .map((category) => profile.media_cards.find((item) => item.category === category))
          .filter(Boolean) as SiteMediaCard[])

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
    <div className="lumino-paper min-h-screen text-[#17211d] dark:text-foreground">
      <SiteNav />

      <main className="mx-auto max-w-7xl px-5 pb-20 pt-7 md:px-8 md:pt-8">
        <section className="grid gap-4 lg:grid-cols-[1.42fr_0.58fr]">
          <div className="relative overflow-hidden rounded-[2.2rem] bg-[#163a2b] p-6 text-white shadow-[0_35px_100px_-55px_rgba(22,58,43,0.95)]">
            {profile.cover_url ? (
              <img
                src={profile.cover_url}
                alt=""
                className="absolute inset-0 h-full w-full object-cover opacity-35"
              />
            ) : (
              <>
                <div className="absolute -right-16 -top-24 h-72 w-72 rounded-full border-[40px] border-[#f7b84b]/16" />
                <div className="absolute -bottom-20 left-1/4 h-52 w-96 rotate-12 rounded-full bg-[#f7b84b]/10 blur-3xl" />
              </>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-[#0b2118]/95 via-[#163a2b]/55 to-[#163a2b]/20" />

            <div className="relative flex h-full flex-col">
              <div className="flex items-center justify-between gap-4">
                <p className="text-xs font-bold uppercase tracking-[0.28em] text-[#f7b84b]">
                  {t.home.welcomeTag}
                </p>
                <span className="hidden rounded-full border border-white/14 bg-white/[0.06] px-3 py-1.5 text-[10px] font-bold tracking-[0.12em] text-white/58 sm:block">
                  {t.home.welcomeEyebrow}
                </span>
              </div>

              <div className="mt-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                  <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-[1.2rem] border border-white/20 bg-white/10 font-display text-2xl font-bold text-[#f7b84b] shadow-2xl">
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
                    <p className="text-sm font-semibold text-white/55">{t.home.greeting}</p>
                    <h1 className="mt-1 font-display text-4xl font-bold leading-none xl:text-[2.7rem]">
                      {profile.display_name}
                    </h1>
                  </div>
                </div>

                <h2 className="mt-4 max-w-3xl font-display text-2xl font-semibold leading-tight text-white/95">
                  {profile.headline}
                </h2>
                <div className="relative mt-3 max-w-4xl border-l border-[#f7b84b]/55 pl-4">
                  <p className="relative whitespace-pre-line font-serif text-sm leading-6 tracking-[0.01em] text-white/78 md:text-base md:leading-7">
                    {profile.bio}
                  </p>
                </div>

                <div className="mt-4 border-t border-white/15 pt-3">
                  <p className="text-[11px] font-semibold text-white/48">
                    {t.home.continueExplore}
                  </p>
                  <div className="mt-2.5 grid gap-2 sm:grid-cols-3">
                    {destinations.map((item) => (
                      <Link
                        key={item.label}
                        href={item.href}
                        className="group flex min-w-0 items-center gap-2 rounded-2xl border border-white/[0.11] bg-white/[0.035] px-3 py-2 text-sm transition hover:border-[#f7b84b]/35 hover:bg-white/[0.07]"
                      >
                        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#f7b84b]/10">
                          <item.icon size={14} className="text-[#f7b84b]" />
                        </span>
                        <span className="min-w-0">
                          <span className="block font-bold text-white">{item.label}</span>
                          <span className="block truncate text-[11px] text-white/44">{item.meaning}</span>
                        </span>
                        <ArrowRight
                          size={13}
                          className="ml-auto shrink-0 text-white/30 transition group-hover:translate-x-1 group-hover:text-[#f7b84b]"
                        />
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <aside className="grid gap-4">
            <div className="relative overflow-hidden rounded-[2rem] border border-[#244a38]/30 bg-[#f9f6ee]/90 p-5 shadow-[0_28px_70px_-52px_rgba(23,33,29,0.75)] dark:border-darkBorder dark:bg-darkCard">
              <div className="absolute -right-14 -top-16 h-40 w-40 rounded-full border-[24px] border-[#1d6347]/[0.055]" />
              <div className="relative">
                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#9b611f]">
                  {t.home.aboutSection.eyebrow}
                </p>
              </div>
              <h2 className="relative mt-3 max-w-[15rem] font-display text-2xl font-bold leading-tight">
                {t.home.aboutSection.title}
              </h2>
              <p className="relative mt-2.5 text-sm leading-6 text-[#17211d]/62 dark:text-foreground/58">
                {t.home.aboutSection.description}
              </p>
              {profile.status_text && profile.status_public && (
                <p className="relative mt-4 border-l-2 border-[#d49a3c] py-1 pl-4 font-display text-sm font-semibold leading-6">
                  {profile.status_text}
                </p>
              )}
            </div>

            <div className="rounded-[2rem] border border-[#7b6747]/30 bg-[#ece6d8]/60 p-5 shadow-[0_22px_60px_-48px_rgba(23,33,29,0.72)] dark:border-darkBorder dark:bg-darkCard/70">
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#9b611f]">
                {t.home.findMeSection.eyebrow}
              </p>
              {publicLinks.length > 0 ? (
                <div className="mt-3 divide-y divide-[#244a38]/10 border-y border-[#244a38]/10">
                  {publicLinks.slice(0, 2).map((item) => (
                    <a
                      key={item.id}
                      href={item.url}
                      target={item.url.startsWith('http') ? '_blank' : undefined}
                      rel={item.url.startsWith('http') ? 'noreferrer' : undefined}
                      className="group flex items-center justify-between py-3 text-sm font-semibold transition hover:text-[#1d6347]"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-[#b56b19]/20 bg-[#f8f4ea]/70 text-[#a6651d]">
                          <item.icon size={14} />
                        </span>
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
                  {t.home.findMeSection.empty}
                </p>
              )}
            </div>
          </aside>
        </section>

        <section className="mt-14">
          <SectionHeading
            eyebrow={t.home.blogSection.eyebrow}
            title={t.home.blogSection.title}
            description={t.home.blogSection.description}
            action={{ label: t.home.blogSection.viewAll, href: '/blog' }}
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
                        {t.home.blogSection.featuredBadge}
                      </span>
                      <span className="rounded-full border border-white/25 bg-white/10 px-3 py-1 text-white/85">
                        {heroPost.category?.name || t.home.blogSection.defaultCategory}
                      </span>
                    </div>
                    <h3 className="mt-4 font-display text-2xl font-bold leading-tight md:text-3xl">
                      {heroPost.title}
                    </h3>
                    <p className="mt-3 line-clamp-2 text-sm leading-6 text-white/68">
                      {heroPost.excerpt || t.home.blogSection.defaultExcerpt}
                    </p>
                    <div className="mt-5 flex items-center justify-between text-xs font-semibold text-white/65">
                      <span className="flex items-center gap-1.5">
                        <Calendar size={13} />
                        {formatDate(heroPost.published_at)}
                      </span>
                      <span className="flex items-center gap-1 text-[#f7b84b]">
                        {t.home.blogSection.readFull} <ArrowUpRight size={16} />
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
                    className="group relative flex min-h-28 flex-col overflow-hidden rounded-3xl border border-[#244a38]/20 bg-[#f7f3ea] p-5 shadow-[0_12px_30px_-28px_rgba(23,33,29,0.8)] transition hover:-translate-y-0.5 hover:border-[#1d6347]/48 hover:bg-[#fbf8f0] hover:shadow-lg dark:border-darkBorder dark:bg-darkCard"
                  >
                    {post.cover_url && (
                      <img
                        src={post.cover_url}
                        alt=""
                        className="absolute inset-0 h-full w-full object-cover opacity-[0.075] transition duration-500 group-hover:scale-105 group-hover:opacity-[0.13]"
                      />
                    )}
                    <div className="relative flex items-center justify-between gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#b56b19]">
                        {String(index + 2).padStart(2, '0')} ·{' '}
                        {post.category?.name || t.home.blogSection.defaultCategory}
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
              <p className="font-display text-lg font-bold">{t.home.blogSection.emptyTitle}</p>
              <p className="mt-2 text-sm text-[#17211d]/50 dark:text-foreground/50">
                {t.home.blogSection.emptyDesc}
              </p>
            </div>
          )}
        </section>

        {favoritePreview.length > 0 && (
          <section className="mt-14">
            <SectionHeading
              eyebrow={t.home.shelvesSection.eyebrow}
              title={t.home.shelvesSection.title}
              description={t.home.shelvesSection.description}
              action={{ label: t.home.shelvesSection.enterLibrary, href: '/library' }}
            />
            <div className="mt-6 flex snap-x snap-mandatory gap-4 overflow-x-auto overscroll-x-contain pb-4">
              {favoritePreview.map((item) => (
                <FavoritePreviewCard key={item.id} item={item} />
              ))}
            </div>
          </section>
        )}
      </main>

      <footer className="border-t border-[#17211d]/10 py-8 text-center text-xs text-[#17211d]/42 dark:border-darkBorder dark:text-foreground/42">
        © {new Date().getFullYear()} Lumino · {t.brand.footerCopy}
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
      <div className="min-w-0">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#b56b19]">{eyebrow}</p>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-baseline sm:gap-5">
          <h2 className="shrink-0 font-display text-2xl font-bold md:text-3xl">{title}</h2>
          <p className="max-w-xl text-sm leading-6 text-[#17211d]/48 dark:text-foreground/48">
            {description}
          </p>
        </div>
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
  const { t } = useLanguage()
  const Icon = mediaMetaIcons[item.category] || Sparkles
  const categoryLabel = t.home.categories[item.category] || item.category
  const creator = item.creator || item.subtitle
  const byline = [creator, item.year].filter(Boolean).join(' · ')

  return (
    <article className="group flex min-h-44 w-[82vw] max-w-[18rem] shrink-0 snap-start gap-4 overflow-hidden rounded-[1.7rem] border border-[#17211d]/10 bg-[#fffdf8] p-4 transition hover:-translate-y-0.5 hover:border-[#1d6347]/30 hover:shadow-lg dark:border-darkBorder dark:bg-darkCard sm:w-[17rem] lg:w-[calc((100%-3rem)/4)] lg:max-w-none">
      <div className="h-36 w-24 shrink-0 overflow-hidden rounded-2xl bg-gradient-to-br from-[#e7efe8] to-[#f7edd9] dark:from-[#163a2b] dark:to-[#2e2518]">
        {item.image_url ? (
          <img
            src={item.image_url}
            alt={item.title}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="grid h-full place-items-center">
            <Icon size={25} className="text-[#b56b19]" />
          </div>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col py-1">
        <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[#b56b19]">
          <Icon size={11} />
          {item.badge || categoryLabel}
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
