'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { DoorOpen, Home, Library, LogOut, Newspaper, UserRound } from 'lucide-react'
import Logo from '@/components/layout/Logo'
import ThemeToggle from '@/components/layout/ThemeToggle'
import LanguageToggle from '@/components/layout/LanguageToggle'
import { useAuth } from '@/hooks/useAuth'
import { useLanguage } from '@/hooks/useLanguage'

type NavKey = 'home' | 'library' | 'blog' | 'courtyard'

const isActivePath = (pathname: string, key: NavKey) => {
  if (key === 'home') return pathname === '/'
  if (key === 'library') return pathname === '/library'
  if (key === 'blog') return pathname === '/blog' || pathname.startsWith('/blog/')
  return (
    pathname === '/courtyard' ||
    pathname === '/dashboard' ||
    pathname.startsWith('/spaces') ||
    pathname.startsWith('/chat') ||
    pathname.startsWith('/discipline')
  )
}

export default function SiteNav() {
  const pathname = usePathname()
  const { user, loading, logout } = useAuth()
  const { t } = useLanguage()
  const courtyardHref = user ? '/dashboard' : '/courtyard'

  const navItems = [
    { key: 'home' as const, label: t.nav.home, title: t.nav.homeTitle, href: '/', icon: Home },
    { key: 'library' as const, label: t.nav.library, title: t.nav.libraryTitle, href: '/library', icon: Library },
    { key: 'blog' as const, label: t.nav.blog, title: t.nav.blogTitle, href: '/blog', icon: Newspaper },
    { key: 'courtyard' as const, label: t.nav.courtyard, title: t.nav.courtyardTitle, href: courtyardHref, icon: DoorOpen },
  ]

  return (
    <header className="sticky top-0 z-40 border-b border-[#17211d]/10 bg-[#f8f6f0]/90 text-[#17211d] backdrop-blur-xl dark:border-darkBorder dark:bg-darkBg/90 dark:text-foreground">
      <div className="mx-auto flex min-h-16 max-w-7xl flex-wrap items-center justify-between gap-x-4 px-5 py-3 md:px-8">
        <Link href="/" className="rounded-xl focus:outline-none focus:ring-2 focus:ring-[#b56b19]/35">
          <Logo size={38} textSize="text-lg" showTagline />
        </Link>

        <nav className="order-3 mt-2 flex w-full items-center gap-1 rounded-2xl bg-white/55 p-1 dark:bg-darkCard/55 sm:order-none sm:mt-0 sm:w-auto">
          {navItems.map((item) => {
            const active = isActivePath(pathname, item.key)
            return (
              <Link
                key={item.key}
                href={item.href}
                title={item.title}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl px-2.5 py-2 text-sm font-semibold transition sm:flex-none sm:px-3 ${
                  active
                    ? 'bg-[#163a2b] text-white shadow-sm'
                    : 'text-[#17211d]/60 hover:bg-white hover:text-[#163a2b] dark:text-foreground/60 dark:hover:bg-darkBorder dark:hover:text-[#f7b84b]'
                }`}
              >
                <item.icon size={14} />
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <LanguageToggle />
          <ThemeToggle />
          {!loading && user ? (
            <>
              <Link
                href="/dashboard"
                className="hidden items-center gap-1.5 rounded-full border border-[#17211d]/12 bg-white/60 px-3 py-2 text-xs font-semibold text-[#17211d]/70 transition hover:border-[#163a2b]/30 hover:text-[#163a2b] dark:border-darkBorder dark:bg-darkCard dark:text-foreground/70 sm:flex"
              >
                <UserRound size={14} />
                {user.display_name || user.username}
              </Link>
              <button
                type="button"
                onClick={logout}
                title={t.nav.logout}
                className="grid h-9 w-9 place-items-center rounded-full text-[#17211d]/45 transition hover:bg-red-50 hover:text-red-500 dark:text-foreground/45 dark:hover:bg-red-500/10"
              >
                <LogOut size={15} />
              </button>
            </>
          ) : !loading ? (
            <>
              <Link
                href="/login"
                className="rounded-full px-3 py-2 text-xs font-semibold text-[#17211d]/65 hover:text-[#163a2b] dark:text-foreground/65"
              >
                {t.nav.login}
              </Link>
              <Link
                href="/register"
                className="hidden rounded-full bg-[#163a2b] px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-[#24553f] sm:block"
              >
                {t.nav.register}
              </Link>
            </>
          ) : null}
        </div>
      </div>
    </header>
  )
}
