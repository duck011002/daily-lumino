'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  ArrowUpRight,
  BookOpen,
  Clapperboard,
  ExternalLink,
  Github,
  Headphones,
  Library,
  Mail,
  Settings2,
  Sparkles,
} from 'lucide-react'
import Link from 'next/link'
import SiteNav from '@/components/layout/SiteNav'
import { useAuth } from '@/hooks/useAuth'
import api from '@/lib/api'
import {
  defaultSiteProfile,
  MediaCategory,
  SiteMediaCard,
  SiteProfile,
} from '@/lib/siteProfile'

type ShelfFilter = 'all' | MediaCategory

const categoryMeta: Record<
  MediaCategory,
  { label: string; description: string; icon: typeof BookOpen }
> = {
  book: {
    label: '书籍',
    description: '读过以后，仍然留在我身上的文字',
    icon: BookOpen,
  },
  movie: {
    label: '影视',
    description: '喜欢的电影、剧集与影像作品',
    icon: Clapperboard,
  },
  music: {
    label: '音乐',
    description: '专辑、歌单与反复循环的声音',
    icon: Headphones,
  },
  status: {
    label: '生活片段',
    description: '最近喜欢的事物与生活切片',
    icon: Sparkles,
  },
  other: {
    label: '其他收藏',
    description: '暂时放不进固定分类的喜欢',
    icon: Library,
  },
}

const filters: Array<{ value: ShelfFilter; label: string }> = [
  { value: 'all', label: '全部收藏' },
  { value: 'book', label: '书籍' },
  { value: 'movie', label: '影视' },
  { value: 'music', label: '音乐 / 歌单' },
  { value: 'status', label: '生活片段' },
  { value: 'other', label: '其他' },
]

export default function LibraryPage() {
  const { user } = useAuth()
  const [profile, setProfile] = useState<SiteProfile>(defaultSiteProfile)
  const [activeFilter, setActiveFilter] = useState<ShelfFilter>('all')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api
      .get<SiteProfile>('/site/profile')
      .then((response) => setProfile(response.data))
      .finally(() => setLoading(false))
  }, [])

  const visibleMedia = useMemo(
    () =>
      activeFilter === 'all'
        ? profile.media_cards
        : profile.media_cards.filter((item) => item.category === activeFilter),
    [activeFilter, profile.media_cards]
  )

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
    <div className="min-h-screen bg-[#f5f1e8] text-[#17211d] dark:bg-darkBg dark:text-foreground">
      <SiteNav />

      <main className="mx-auto max-w-7xl px-5 pb-20 pt-8 md:px-8 md:pt-12">
        <section className="relative overflow-hidden rounded-[2.4rem] bg-[#163a2b] px-7 py-12 text-white shadow-[0_35px_100px_-55px_rgba(22,58,43,0.95)] md:px-12 md:py-16">
          {profile.cover_url ? (
            <img
              src={profile.cover_url}
              alt=""
              className="absolute inset-0 h-full w-full object-cover opacity-25"
            />
          ) : (
            <>
              <div className="absolute -right-28 -top-32 h-96 w-96 rounded-full border-[54px] border-[#f7b84b]/12" />
              <div className="absolute -bottom-36 left-1/4 h-72 w-[36rem] rounded-full bg-[#f7b84b]/10 blur-3xl" />
            </>
          )}
          <div className="absolute inset-0 bg-gradient-to-r from-[#0b2118]/90 via-[#163a2b]/72 to-[#163a2b]/40" />

          <div className="relative grid gap-10 lg:grid-cols-[1fr_0.58fr] lg:items-end">
            <div>
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-2xl border border-white/15 bg-white/[0.07] text-[#f7b84b]">
                  <Library size={20} />
                </span>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#f7b84b]">
                    The study
                  </p>
                  <p className="mt-1 text-xs text-white/48">书房 · 关于我与收藏</p>
                </div>
              </div>
              <h1 className="mt-8 max-w-4xl font-display text-4xl font-bold leading-tight md:text-6xl">
                这里放着我的自我介绍，
                <br className="hidden sm:block" />
                也放着我喜欢的作品。
              </h1>
              <p className="mt-6 max-w-2xl text-sm leading-7 text-white/65 md:text-base">
                不为每一本书、每一部电影或每一张歌单单独建档，只留下作品、作者和一句真实的推荐理由。
              </p>
            </div>

            <div className="rounded-[1.8rem] border border-white/14 bg-white/[0.07] p-5 backdrop-blur-sm md:p-6">
              <div className="flex items-center gap-4">
                <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-2xl border border-white/15 bg-white/10 font-display text-2xl font-bold text-[#f7b84b]">
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
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-white/48">书房主人</p>
                  <h2 className="mt-1 truncate font-display text-2xl font-bold">
                    {profile.display_name}
                  </h2>
                </div>
              </div>
              <p className="mt-5 text-sm font-semibold leading-6 text-white/85">
                {profile.headline}
              </p>
              {user?.is_root && (
                <Link
                  href="/admin/profile"
                  className="mt-5 inline-flex items-center gap-2 text-xs font-bold text-[#f7b84b]"
                >
                  <Settings2 size={13} />
                  编辑书房内容
                </Link>
              )}
            </div>
          </div>
        </section>

        <section className="mt-7 grid gap-5 lg:grid-cols-[1.28fr_0.72fr]">
          <div className="rounded-[2rem] border-2 border-[#244a38]/25 bg-[#f8f5ed] p-7 shadow-[0_22px_60px_-46px_rgba(23,33,29,0.72)] dark:border-darkBorder dark:bg-darkCard md:p-9">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#b56b19]">
              About me
            </p>
            <h2 className="mt-3 font-display text-3xl font-bold">关于我</h2>
            <p className="mt-5 whitespace-pre-line text-sm leading-8 text-[#17211d]/65 dark:text-foreground/65 md:text-base">
              {profile.bio}
            </p>
            {profile.interest_tags.length > 0 && (
              <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-[#244a38]/20 pt-4">
                {profile.interest_tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-2 text-xs font-semibold text-[#1d6347] dark:text-[#f7b84b]"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-[#c98b30]" />
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="grid gap-5">
            {profile.status_text && profile.status_public && (
              <div className="rounded-[2rem] border-2 border-[#244a38]/25 bg-[#e6ebe3] p-7 shadow-[0_18px_50px_-42px_rgba(23,33,29,0.72)] dark:border-[#f7b84b]/25 dark:bg-[#20392f]">
                <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-[#1d6347] dark:text-[#f7b84b]">
                  <Sparkles size={14} />
                  此刻
                </p>
                <p className="mt-3 border-l-2 border-[#c98b30] pl-4 font-display text-sm font-semibold leading-7">
                  {profile.status_text}
                </p>
              </div>
            )}

            <div className="rounded-[2rem] border-2 border-[#7b6747]/25 bg-[#eee8dc]/72 p-7 shadow-[0_18px_48px_-44px_rgba(74,58,38,0.7)] dark:border-darkBorder dark:bg-darkCard/65">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#b56b19]">
                Say hello
              </p>
              {publicLinks.length > 0 ? (
                <div className="mt-4 divide-y divide-[#244a38]/20 border-y border-[#244a38]/20">
                  {publicLinks.map((item) => (
                    <a
                      key={item.id}
                      href={item.url}
                      target={item.url.startsWith('http') ? '_blank' : undefined}
                      rel={item.url.startsWith('http') ? 'noreferrer' : undefined}
                      className="group flex max-w-full items-center gap-2 py-3 text-xs font-semibold transition hover:text-[#1d6347]"
                    >
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-[#b56b19]/25 bg-[#f8f4ea]/70 text-[#a6651d]">
                        <item.icon size={14} />
                      </span>
                      <span className="truncate">{item.label}</span>
                      <ArrowUpRight
                        size={12}
                        className="ml-auto shrink-0 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                      />
                    </a>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-sm text-[#17211d]/45 dark:text-foreground/45">
                  暂时没有公开联系方式。
                </p>
              )}
            </div>
          </div>
        </section>

        <section className="mt-14">
          <div className="flex flex-col gap-5 border-b border-[#17211d]/10 pb-5 dark:border-darkBorder md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#b56b19]">
                Personal recommendations
              </p>
              <h2 className="mt-2 font-display text-3xl font-bold">我的推荐清单</h2>
              <p className="mt-2 text-sm text-[#17211d]/48 dark:text-foreground/48">
                {profile.media_cards.length > 0
                  ? `目前公开分享 ${profile.media_cards.length} 件喜欢的作品。`
                  : '书房的收藏架还在慢慢整理。'}
              </p>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {filters.map((filter) => {
                const count =
                  filter.value === 'all'
                    ? profile.media_cards.length
                    : profile.media_cards.filter((item) => item.category === filter.value).length
                return (
                  <button
                    key={filter.value}
                    type="button"
                    onClick={() => setActiveFilter(filter.value)}
                    className={`shrink-0 rounded-full px-4 py-2 text-xs font-semibold transition ${
                      activeFilter === filter.value
                        ? 'bg-[#163a2b] text-white'
                        : 'border border-[#17211d]/10 bg-[#fffdf8] text-[#17211d]/58 hover:border-[#1d6347]/35 hover:text-[#1d6347] dark:border-darkBorder dark:bg-darkCard dark:text-foreground/58'
                    }`}
                  >
                    {filter.label}
                    {count > 0 && <span className="ml-1.5 opacity-55">{count}</span>}
                  </button>
                )
              })}
            </div>
          </div>

          {loading ? (
            <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {[0, 1, 2, 3].map((item) => (
                <div
                  key={item}
                  className="h-[28rem] animate-pulse rounded-[2rem] bg-white/55 dark:bg-darkCard/45"
                />
              ))}
            </div>
          ) : visibleMedia.length > 0 ? (
            <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {visibleMedia.map((item) => (
                <RecommendationCard key={item.id} item={item} />
              ))}
            </div>
          ) : (
            <div className="mt-6 rounded-[2rem] border border-dashed border-[#17211d]/14 bg-white/35 px-6 py-14 text-center dark:border-darkBorder dark:bg-darkCard/25">
              <Library className="mx-auto h-8 w-8 text-[#b56b19]/60" />
              <p className="mt-4 font-display text-xl font-bold">
                {activeFilter === 'all' ? '收藏架还在慢慢整理' : '这个分类暂时没有公开内容'}
              </p>
              <p className="mt-2 text-sm text-[#17211d]/45 dark:text-foreground/45">
                喜欢的东西值得慢慢收集，不需要为了填满页面而匆忙添加。
              </p>
            </div>
          )}
        </section>
      </main>

      <footer className="border-t border-[#17211d]/10 py-8 text-center text-xs text-[#17211d]/42 dark:border-darkBorder dark:text-foreground/42">
        Lumino · 书房里的每一件收藏都由本人挑选
      </footer>
    </div>
  )
}

function RecommendationCard({ item }: { item: SiteMediaCard }) {
  const meta = categoryMeta[item.category]
  const creator = item.creator || item.subtitle
  const byline = [creator, item.year].filter(Boolean).join(' · ')

  return (
    <article className="group overflow-hidden rounded-[2rem] border-2 border-[#244a38]/20 bg-[#fffdf8] shadow-[0_14px_42px_-40px_rgba(23,33,29,0.7)] transition hover:-translate-y-1 hover:border-[#1d6347]/40 hover:shadow-[0_24px_65px_-42px_rgba(23,33,29,0.65)] dark:border-darkBorder dark:bg-darkCard">
      <div className="relative aspect-[2/3] overflow-hidden bg-gradient-to-br from-[#dce9df] via-[#eee8d9] to-[#f7dfb8] dark:from-[#163a2b] dark:via-[#243c32] dark:to-[#4a3820]">
        {item.image_url ? (
          <img
            src={item.image_url}
            alt={item.title}
            className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
          />
        ) : (
          <div className="grid h-full place-items-center">
            <meta.icon size={42} className="text-[#b56b19]/60" />
          </div>
        )}
        <div className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-[#fffdf8]/90 px-3 py-1.5 text-[10px] font-bold text-[#17211d] shadow-sm backdrop-blur dark:bg-darkBg/85 dark:text-foreground">
          <meta.icon size={11} className="text-[#b56b19]" />
          {item.badge || meta.label}
        </div>
      </div>

      <div className="flex min-h-52 flex-col p-6">
        <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#b56b19]">
          {meta.label}
        </p>
        <h3 className="mt-2 font-display text-2xl font-bold leading-tight">{item.title}</h3>
        {byline && (
          <p className="mt-2 text-xs font-semibold text-[#17211d]/45 dark:text-foreground/45">
            {byline}
          </p>
        )}
        {item.note && (
          <p className="mt-4 line-clamp-3 text-sm leading-7 text-[#17211d]/58 dark:text-foreground/58">
            {item.note}
          </p>
        )}
        {item.url ? (
          <a
            href={item.url}
            target="_blank"
            rel="noreferrer"
            className="group/link mt-auto inline-flex w-fit items-center gap-2 pt-5 text-xs font-bold text-[#1d6347] dark:text-[#f7b84b]"
          >
            查看外部介绍
            <ArrowUpRight
              size={14}
              className="transition group-hover/link:-translate-y-0.5 group-hover/link:translate-x-0.5"
            />
          </a>
        ) : (
          <p className="mt-auto pt-5 text-[11px] text-[#17211d]/32 dark:text-foreground/32">
            仅作个人推荐，不设站内详情页
          </p>
        )}
      </div>
    </article>
  )
}
