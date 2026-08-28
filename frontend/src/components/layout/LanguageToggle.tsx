'use client'

import React from 'react'
import { Languages } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'

interface LanguageToggleProps {
  className?: string
  showText?: boolean
}

export default function LanguageToggle({
  className = '',
  showText = true,
}: LanguageToggleProps) {
  const { toggleLanguage, isZh, t } = useLanguage()

  return (
    <button
      type="button"
      onClick={toggleLanguage}
      className={`group relative inline-flex items-center justify-center gap-1 rounded-full p-2 text-primary transition-colors duration-200 hover:bg-secondary/40 dark:hover:bg-darkBorder/40 ${className}`}
      aria-label={t.nav.toggleLanguage}
      title={isZh ? 'Switch to English' : '切换为简体中文'}
    >
      <Languages className="h-5 w-5 shrink-0 transition-transform duration-300 group-hover:scale-110" />
      {showText && (
        <span className="select-none font-mono text-[11px] font-bold uppercase tracking-wider text-[#163a2b] dark:text-[#f7b84b]">
          {isZh ? 'EN' : '中'}
        </span>
      )}
    </button>
  )
}
