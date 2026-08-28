'use client'

import { useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowRight,
  FolderHeart,
  HeartPulse,
  Images,
  Loader2,
  LockKeyhole,
  MessagesSquare,
  NotebookPen,
  Sparkles,
} from 'lucide-react'
import SiteNav from '@/components/layout/SiteNav'
import { useAuth } from '@/hooks/useAuth'
import { useLanguage } from '@/hooks/useLanguage'

export default function CourtyardPorch() {
  const router = useRouter()
  const { user, loading } = useAuth()
  const { t } = useLanguage()

  useEffect(() => {
    if (!loading && user) router.replace('/dashboard')
  }, [loading, router, user])

  const capabilities = useMemo(
    () => [
      {
        icon: MessagesSquare,
        title: t.courtyard.features.chat.title,
        description: t.courtyard.features.chat.description,
      },
      {
        icon: FolderHeart,
        title: t.courtyard.features.spaces.title,
        description: t.courtyard.features.spaces.description,
      },
      {
        icon: Images,
        title: t.courtyard.features.albums.title,
        description: t.courtyard.features.albums.description,
      },
      {
        icon: NotebookPen,
        title: t.courtyard.features.notes.title,
        description: t.courtyard.features.notes.description,
      },
      {
        icon: HeartPulse,
        title: t.courtyard.features.discipline.title,
        description: t.courtyard.features.discipline.description,
      },
    ],
    [t]
  )

  if (loading || user) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#f8f6f0] dark:bg-darkBg">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#b56b19]" />
          <p className="mt-3 text-sm text-[#17211d]/50 dark:text-foreground/50">
            {user ? t.courtyard.redirecting : t.courtyard.checking}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f2f0e9] text-[#17211d] dark:bg-darkBg dark:text-foreground">
      <SiteNav />
      <main className="mx-auto max-w-7xl px-5 pb-20 pt-8 md:px-8 md:pt-12">
        <section className="relative overflow-hidden rounded-[2.4rem] bg-[#163a2b] px-7 py-14 text-white shadow-[0_35px_100px_-55px_rgba(22,58,43,0.95)] md:px-12 md:py-20">
          <div className="absolute -right-28 -top-28 h-96 w-96 rounded-full border-[54px] border-[#f7b84b]/14" />
          <div className="absolute -bottom-32 left-1/4 h-64 w-[36rem] rounded-full bg-[#f7b84b]/10 blur-3xl" />
          <div className="relative max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/8 px-3 py-1.5 text-xs font-semibold text-white/72">
              <LockKeyhole size={13} className="text-[#f7b84b]" />
              {t.courtyard.badge}
            </div>
            <h1 className="mt-6 whitespace-pre-line font-display text-4xl font-bold leading-tight md:text-6xl">
              {t.courtyard.heroTitle}
            </h1>
            <p className="mt-6 max-w-2xl text-sm leading-7 text-white/66 md:text-base">
              {t.courtyard.heroDesc}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/login"
                className="inline-flex items-center gap-2 rounded-full bg-[#f7b84b] px-5 py-3 text-sm font-bold text-[#17211d] transition hover:bg-[#ffc963]"
              >
                {t.courtyard.enterBtn}
                <ArrowRight size={16} />
              </Link>
              <Link
                href="/register"
                className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/8 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/14"
              >
                {t.courtyard.registerWithCode}
              </Link>
            </div>
          </div>
        </section>

        <section className="mt-12">
          <div className="flex flex-col gap-3 border-b border-[#17211d]/10 pb-5 dark:border-darkBorder md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#b56b19]">
                Inside the courtyard
              </p>
              <h2 className="mt-2 font-display text-3xl font-bold">{t.courtyard.whatIsInside}</h2>
            </div>
            <p className="text-sm text-[#17211d]/48 dark:text-foreground/48">
              {t.courtyard.whatIsInsideDesc}
            </p>
          </div>

          <div className="mt-6 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {capabilities.map((item, index) => (
              <div
                key={item.title}
                className={`rounded-[1.8rem] border border-[#17211d]/10 bg-[#fffdf8] p-7 dark:border-darkBorder dark:bg-darkCard ${
                  index === capabilities.length - 1 ? 'md:col-span-2 lg:col-span-1' : ''
                }`}
              >
                <div className="flex items-start justify-between">
                  <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#e7efe8] text-[#1d6347] dark:bg-[#163a2b] dark:text-[#f7b84b]">
                    <item.icon size={22} />
                  </span>
                  <span className="rounded-full bg-[#f1eee5] px-2.5 py-1 text-[10px] font-bold text-[#17211d]/45 dark:bg-darkBg dark:text-foreground/45">
                    {t.courtyard.requiresLogin}
                  </span>
                </div>
                <h3 className="mt-6 font-display text-xl font-bold">{item.title}</h3>
                <p className="mt-3 text-sm leading-7 text-[#17211d]/58 dark:text-foreground/58">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-12 rounded-[2rem] border border-[#b56b19]/18 bg-[#fbf1df] px-7 py-8 dark:border-[#f7b84b]/15 dark:bg-[#2e2518] md:flex md:items-center md:justify-between">
          <div>
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.17em] text-[#b56b19] dark:text-[#f7b84b]">
              <Sparkles size={14} />
              Privacy first
            </p>
            <h2 className="mt-3 font-display text-2xl font-bold">{t.courtyard.privacyTitle}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#17211d]/58 dark:text-foreground/58">
              {t.courtyard.privacyDesc}
            </p>
          </div>
          <Link
            href="/"
            className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-[#1d6347] dark:text-[#f7b84b] md:mt-0"
          >
            {t.courtyard.backToPorch}
            <ArrowRight size={15} />
          </Link>
        </section>
      </main>
    </div>
  )
}
