'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

const isPublicContentPath = (path: string) => {
  if (path === '/' || path === '/blog' || path === '/library') return true
  if (path === '/blog/manage' || path === '/blog/write') return false
  return path.startsWith('/blog/')
}

const externalReferrerHost = () => {
  if (!document.referrer) return null
  try {
    const referrer = new URL(document.referrer)
    return referrer.origin === window.location.origin ? null : referrer.hostname
  } catch {
    return null
  }
}

export default function VisitTracker() {
  const pathname = usePathname()

  useEffect(() => {
    if (!pathname || !isPublicContentPath(pathname)) return
    if (navigator.doNotTrack === '1') return

    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      void fetch('/api/analytics/visit', {
        method: 'POST',
        credentials: 'same-origin',
        keepalive: true,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: pathname,
          referrer_host: externalReferrerHost(),
        }),
        signal: controller.signal,
      }).catch(() => undefined)
    }, 800)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [pathname])

  return null
}
