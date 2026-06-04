'use client'

import React from 'react'
import { Sun, Moon } from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'

export default function ThemeToggle() {
  const { toggleTheme, isDark } = useTheme()

  return (
    <button
      onClick={toggleTheme}
      className="p-2 rounded-full hover:bg-secondary/40 dark:hover:bg-darkBorder/40 transition-colors duration-200"
      aria-label="切换主题"
    >
      {isDark ? (
        <Sun className="h-5 w-5 text-primary" />
      ) : (
        <Moon className="h-5 w-5 text-primary" />
      )}
    </button>
  )
}
