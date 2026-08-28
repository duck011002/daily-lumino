'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import {
  ArrowRight,
  CheckSquare,
  FolderHeart,
  HeartPulse,
  Images,
  LockKeyhole,
  MessageCircleHeart,
  NotebookPen,
  Settings,
  ShieldCheck,
  Sparkles,
  UserRound,
  WalletCards,
} from 'lucide-react'
import SiteNav from '@/components/layout/SiteNav'
import { useAuth } from '@/hooks/useAuth'
import { useLanguage } from '@/hooks/useLanguage'

export default function Dashboard() {
  const { user, loading } = useAuth()
  const { t } = useLanguage()

  const personalTools = useMemo(
    () => [
      {
        id: 'btn-ledger',
        title: t.dashboard.tools.ledger.title,
        description: t.dashboard.tools.ledger.description,
        href: '/ledger',
        icon: WalletCards,
        accent: 'bg-[#e4f0e8] text-[#1d6347] dark:bg-[#1d382c] dark:text-[#86d3ab]',
        show: true,
      },
      {
        id: 'btn-todos',
        title: t.dashboard.tools.todos.title,
        description: t.dashboard.tools.todos.description,
        href: '/todos',
        icon: CheckSquare,
        accent: 'bg-[#f7edd9] text-[#b56b19] dark:bg-[#3d311b] dark:text-[#f7b84b]',
        show: true,
      },
      {
        id: 'btn-ai-chat',
        title: t.dashboard.tools.chat.title,
        description: t.dashboard.tools.chat.description,
        href: '/chat',
        icon: MessageCircleHeart,
        accent: 'bg-[#e8e7f7] text-[#5b57a6] dark:bg-[#29264d] dark:text-[#b9b4ff]',
        show: true,
      },
      {
        id: 'btn-discipline',
        title: t.dashboard.tools.discipline.title,
        description: t.dashboard.tools.discipline.description,
        href: '/discipline',
        icon: HeartPulse,
        accent: 'bg-[#fae8e5] text-[#b9554f] dark:bg-[#4a2525] dark:text-[#ffaaa2]',
        show: Boolean(user?.is_root || user?.is_discipline_authorized),
      },
    ].filter((item) => item.show),
    [t, user]
  )

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#f2f0e9] text-[#1d6347] dark:bg-darkBg dark:text-[#f7b84b]">
        <div className="text-center">
          <Sparkles className="mx-auto h-7 w-7 animate-pulse" />
          <p className="mt-3 text-sm font-semibold">{t.courtyard.redirecting}</p>
        </div>
      </div>
    )
  }

  if (!user) return null

  const accountCardContent = (
    <>
      <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-2xl bg-white/10 text-[#f7b84b]">
        {user.avatar_url ? (
          <img
            src={user.avatar_url}
            alt={user.display_name || user.username}
            className="h-full w-full object-cover"
          />
        ) : (
          <UserRound size={25} />
        )}
      </div>
      <div className="min-w-0 pr-7">
        <p className="text-xs text-white/45">{t.dashboard.currentAccount}</p>
        <p className="mt-1 truncate text-sm font-bold">
          {user.display_name || user.username}
        </p>
        <p className="mt-1 truncate text-xs text-white/48">{user.email}</p>
      </div>
    </>
  )

  return (
    <div className="min-h-screen bg-[#f2f0e9] text-[#17211d] transition-colors dark:bg-darkBg dark:text-foreground">
      <SiteNav />

      <main className="mx-auto max-w-7xl px-5 pb-20 pt-8 md:px-8 md:pt-12">
        <section className="relative overflow-hidden rounded-[2.4rem] bg-[#163a2b] px-7 py-10 text-white shadow-[0_35px_100px_-55px_rgba(22,58,43,0.95)] md:px-11 md:py-12">
          <div className="absolute -right-24 -top-28 h-80 w-80 rounded-full border-[44px] border-[#f7b84b]/12" />
          <div className="absolute -bottom-24 left-1/3 h-52 w-96 rounded-full bg-[#f7b84b]/10 blur-3xl" />
          <div className="relative flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/14 bg-white/[0.07] px-3 py-1.5 text-xs font-semibold text-white/62">
                <LockKeyhole size={13} className="text-[#f7b84b]" />
                {t.dashboard.badge}
              </div>
              <h1 className="mt-6 font-display text-4xl font-bold md:text-5xl">
                {t.dashboard.welcomeUser.replace('{name}', user.display_name || user.username)}
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-white/62 md:text-base">
                {t.dashboard.introDesc}
              </p>
            </div>

            {user.is_root ? (
              <Link
                id="btn-admin-panel"
                href="/admin"
                aria-label={t.dashboard.adminPanelAria}
                className="group relative flex items-center gap-4 rounded-[1.6rem] border border-white/16 bg-[#0b2118]/50 p-4 pr-5 backdrop-blur-sm transition hover:-translate-y-0.5 hover:border-[#f7b84b]/55 hover:bg-[#0b2118]/72 focus:outline-none focus:ring-2 focus:ring-[#f7b84b]/45"
              >
                {accountCardContent}
                <span className="absolute right-4 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full border border-white/12 bg-white/[0.06] text-white/48 transition group-hover:border-[#f7b84b]/35 group-hover:text-[#f7b84b]">
                  <Settings size={13} />
                </span>
              </Link>
            ) : (
              <div className="flex items-center gap-4 rounded-[1.6rem] border border-white/16 bg-[#0b2118]/50 p-4 backdrop-blur-sm">
                {accountCardContent}
              </div>
            )}
          </div>
        </section>

        <section className="mt-12">
          <SectionHeading
            eyebrow={t.dashboard.forYourselfEyebrow}
            title={t.dashboard.forYourselfTitle}
            description={t.dashboard.forYourselfDesc}
          />
          <div
            className={`mt-6 grid gap-5 ${
              personalTools.length > 1 ? 'md:grid-cols-2' : 'md:grid-cols-2'
            }`}
          >
            {personalTools.map((item) => (
              <ToolCard key={item.id} item={item} openLabel={t.dashboard.openBtn} />
            ))}
          </div>
        </section>

        <section className="mt-12">
          <SectionHeading
            eyebrow={t.dashboard.sharedMemoriesEyebrow}
            title={t.dashboard.sharedMemoriesTitle}
            description={t.dashboard.sharedMemoriesDesc}
          />
          <Link
            id="btn-spaces"
            href="/spaces"
            className="group mt-6 grid overflow-hidden rounded-[2rem] border border-[#17211d]/10 bg-[#fffdf8] transition hover:-translate-y-0.5 hover:border-[#1d6347]/30 hover:shadow-[0_26px_70px_-48px_rgba(23,33,29,0.65)] dark:border-darkBorder dark:bg-darkCard lg:grid-cols-[0.75fr_1.25fr]"
          >
            <div className="relative min-h-56 overflow-hidden bg-[#163a2b] p-7 text-white md:p-9">
              <div className="absolute -right-16 -top-16 h-52 w-52 rounded-full border-[30px] border-[#f7b84b]/14" />
              <div className="relative">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white/10 text-[#f7b84b]">
                  <FolderHeart size={23} />
                </span>
                <h3 className="mt-7 font-display text-3xl font-bold">{t.dashboard.sharedSpacesTitle}</h3>
                <p className="mt-3 max-w-sm text-sm leading-7 text-white/62">
                  {t.dashboard.sharedSpacesDesc}
                </p>
                <span className="mt-7 inline-flex items-center gap-2 text-sm font-bold text-[#f7b84b]">
                  {t.dashboard.viewMySpaces}
                  <ArrowRight
                    size={15}
                    className="transition group-hover:translate-x-1"
                  />
                </span>
              </div>
            </div>

            <div className="grid gap-4 p-6 sm:grid-cols-2 md:p-8">
              <Feature
                icon={Images}
                title={t.dashboard.spaceFeatures.album.title}
                description={t.dashboard.spaceFeatures.album.description}
              />
              <Feature
                icon={NotebookPen}
                title={t.dashboard.spaceFeatures.notes.title}
                description={t.dashboard.spaceFeatures.notes.description}
              />
              <Feature
                icon={ShieldCheck}
                title={t.dashboard.spaceFeatures.permissions.title}
                description={t.dashboard.spaceFeatures.permissions.description}
              />
              <Feature
                icon={Sparkles}
                title={t.dashboard.spaceFeatures.growth.title}
                description={t.dashboard.spaceFeatures.growth.description}
              />
            </div>
          </Link>
        </section>
      </main>
    </div>
  )
}

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string
  title: string
  description: string
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-[#17211d]/10 pb-5 dark:border-darkBorder md:flex-row md:items-end md:justify-between">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#b56b19]">{eyebrow}</p>
        <h2 className="mt-2 font-display text-3xl font-bold">{title}</h2>
      </div>
      <p className="text-sm text-[#17211d]/48 dark:text-foreground/48">{description}</p>
    </div>
  )
}

function ToolCard({
  item,
  openLabel,
}: {
  item: {
    id: string
    title: string
    description: string
    href: string
    icon: typeof Sparkles
    accent: string
  }
  openLabel: string
}) {
  return (
    <Link
      id={item.id}
      href={item.href}
      className="group flex min-h-56 flex-col rounded-[2rem] border border-[#17211d]/10 bg-[#fffdf8] p-7 transition hover:-translate-y-0.5 hover:border-[#1d6347]/30 hover:shadow-[0_24px_65px_-44px_rgba(23,33,29,0.65)] dark:border-darkBorder dark:bg-darkCard md:p-8"
    >
      <span className={`grid h-12 w-12 place-items-center rounded-2xl ${item.accent}`}>
        <item.icon size={22} />
      </span>
      <h3 className="mt-6 font-display text-2xl font-bold">{item.title}</h3>
      <p className="mt-3 max-w-xl text-sm leading-7 text-[#17211d]/58 dark:text-foreground/58">
        {item.description}
      </p>
      <span className="mt-auto inline-flex items-center gap-2 pt-5 text-sm font-bold text-[#1d6347] dark:text-[#f7b84b]">
        {openLabel}
        <ArrowRight size={15} className="transition group-hover:translate-x-1" />
      </span>
    </Link>
  )
}

function Feature({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Sparkles
  title: string
  description: string
}) {
  return (
    <div className="rounded-2xl border border-[#17211d]/8 bg-[#f7f4ec] p-5 dark:border-darkBorder dark:bg-darkBg/60">
      <Icon size={18} className="text-[#b56b19]" />
      <h4 className="mt-3 font-bold">{title}</h4>
      <p className="mt-2 text-xs leading-6 text-[#17211d]/52 dark:text-foreground/52">
        {description}
      </p>
    </div>
  )
}
