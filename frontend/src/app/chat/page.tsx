'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import api from '@/lib/api'

export default function ChatIndexPage() {
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    let active = true

    const checkLastSession = async () => {
      try {
        const response = await api.get('/chat/sessions')
        if (active) {
          const sessions = response.data
          if (sessions && sessions.length > 0) {
            router.replace(`/chat/${sessions[0].id}`)
          } else {
            setLoading(false)
          }
        }
      } catch (err) {
        if (active) {
          setLoading(false)
        }
      }
    }

    checkLastSession()

    return () => {
      active = false
    }
  }, [router])

  if (loading) {
    return (
      <div className="h-full flex flex-col justify-center items-center bg-surface dark:bg-darkBg transition-colors duration-300">
        <Loader2 className="animate-spin text-primary h-8 w-8 mb-2" />
        <p className="text-sm text-onSurface/60 dark:text-foreground/60">加载中...</p>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col justify-center items-center bg-surface dark:bg-darkBg p-6 text-center transition-colors duration-300">
      <div className="max-w-md space-y-6">
        <div className="inline-flex h-16 w-16 rounded-3xl bg-primary/10 text-primary items-center justify-center font-bold text-2xl select-none">
          💬
        </div>
        <div className="space-y-2">
          <h2 className="text-3xl font-extrabold text-onSurface dark:text-foreground tracking-tight">
            AI 智能对话
          </h2>
          <p className="text-sm text-onSurface/60 dark:text-foreground/60 leading-relaxed">
            欢迎来到 Lumino 智能助手。选择左侧已有的对话，或者开启一个新的会话。您可以随时在通义千问 (Qwen) 与 DeepSeek 之间切换。
          </p>
        </div>
      </div>
    </div>
  )
}
