'use client'

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { dictionaries, Locale, LocaleDictionary } from '@/locales'

interface LanguageContextType {
  locale: Locale
  setLocale: (locale: Locale) => void
  toggleLanguage: () => void
  t: LocaleDictionary
  isZh: boolean
  isEn: boolean
  formatDate: (
    date: string | number | Date | null | undefined,
    options?: Intl.DateTimeFormatOptions
  ) => string
}

const STORAGE_KEY = 'lumino_locale'

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('zh')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    try {
      const savedLocale = localStorage.getItem(STORAGE_KEY) as Locale | null
      if (savedLocale === 'zh' || savedLocale === 'en') {
        setLocaleState(savedLocale)
        document.documentElement.lang = savedLocale === 'zh' ? 'zh-CN' : 'en'
      } else {
        const browserLang = navigator.language.toLowerCase()
        const initialLocale: Locale = browserLang.startsWith('en') ? 'en' : 'zh'
        setLocaleState(initialLocale)
        document.documentElement.lang = initialLocale === 'zh' ? 'zh-CN' : 'en'
      }
    } catch {
      // Ignore localStorage errors in private browsing/sandboxed environments
    } finally {
      setMounted(true)
    }
  }, [])

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale)
    try {
      localStorage.setItem(STORAGE_KEY, newLocale)
      document.documentElement.lang = newLocale === 'zh' ? 'zh-CN' : 'en'
    } catch {
      // Ignore localStorage write error
    }
  }, [])

  const toggleLanguage = useCallback(() => {
    setLocaleState((prev) => {
      const next: Locale = prev === 'zh' ? 'en' : 'zh'
      try {
        localStorage.setItem(STORAGE_KEY, next)
        document.documentElement.lang = next === 'zh' ? 'zh-CN' : 'en'
      } catch {
        // Ignore write error
      }
      return next
    })
  }, [])

  const t = useMemo(() => dictionaries[locale] || dictionaries.zh, [locale])

  const formatDate = useCallback(
    (
      date: string | number | Date | null | undefined,
      options?: Intl.DateTimeFormatOptions
    ): string => {
      if (!date) return t.home.blogSection.recentPost
      try {
        const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date
        if (Number.isNaN(d.getTime())) return t.home.blogSection.recentPost
        const defaultOptions: Intl.DateTimeFormatOptions = options || {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        }
        const intlLocale = locale === 'zh' ? 'zh-CN' : 'en-US'
        return new Intl.DateTimeFormat(intlLocale, defaultOptions).format(d)
      } catch {
        return String(date)
      }
    },
    [locale, t]
  )

  const value = useMemo(
    () => ({
      locale,
      setLocale,
      toggleLanguage,
      t,
      isZh: locale === 'zh',
      isEn: locale === 'en',
      formatDate,
    }),
    [locale, setLocale, toggleLanguage, t, formatDate]
  )

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider')
  }
  return context
}
