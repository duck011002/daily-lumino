'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import ThemeToggle from '@/components/layout/ThemeToggle'
import Button from '@/components/ui/Button'
import api, { getErrorMessage } from '@/lib/api'

export default function InviteRequestPage() {
  const [email, setEmail] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [message, setMessage] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')
    setSuccessMsg('')

    if (!email.trim()) {
      setErrorMsg('请输入邮箱地址。')
      return
    }

    setIsLoading(true)
    try {
      const response = await api.post('/auth/invite-requests', {
        email: email.trim(),
        display_name: displayName.trim() || null,
        message: message.trim() || null,
      })
      setSuccessMsg(
        response.data?.message || '如果该邮箱可以接收申请邮件，请查收并完成邮箱验证'
      )
      setMessage('')
    } catch (err: any) {
      setErrorMsg(getErrorMessage(err, '申请失败，请稍后重试。'))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex-1 min-h-screen bg-surface dark:bg-darkBg flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden transition-colors duration-300">
      <div className="absolute top-[10%] left-[20%] w-[35%] h-[35%] bg-primary/10 rounded-full blur-[80px] pointer-events-none" />
      <div className="absolute bottom-[10%] right-[20%] w-[35%] h-[35%] bg-primary/5 rounded-full blur-[80px] pointer-events-none" />

      <div className="absolute top-6 right-6 z-20">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-md z-10">
        <div className="glassmorphism p-8 md:p-10 rounded-3xl shadow-xl transition-all duration-300">
          <div className="text-center mb-8">
            <Link href="/" passHref>
              <span className="font-display text-3xl font-bold tracking-wide text-primary cursor-pointer">
                Lumino
              </span>
            </Link>
            <h2 className="text-xl font-bold text-onSurface dark:text-foreground mt-4">
              申请邀请码
            </h2>
            <p className="text-xs text-onSurface/60 dark:text-foreground/60 mt-1">
              验证邮箱后，我们会将申请发送给管理员审核
            </p>
          </div>

          {errorMsg ? (
            <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
              {errorMsg}
            </div>
          ) : null}

          {successMsg ? (
            <div className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-sm">
              {successMsg}
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="input-email"
                className="block text-xs font-semibold text-onSurface/70 dark:text-foreground/70 uppercase tracking-wider mb-2"
              >
                邮箱地址 <span className="text-red-500">*</span>
              </label>
              <input
                id="input-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="请输入可接收邮件的邮箱地址"
                className="w-full px-4 py-3 rounded-xl border border-secondary dark:border-darkBorder bg-white/50 dark:bg-darkCard/50 text-onSurface dark:text-foreground placeholder-onSurface/40 dark:placeholder-foreground/30 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all duration-200"
                required
              />
            </div>

            <div>
              <label
                htmlFor="input-displayname"
                className="block text-xs font-semibold text-onSurface/70 dark:text-foreground/70 uppercase tracking-wider mb-2"
              >
                用户名或称呼（可选）
              </label>
              <input
                id="input-displayname"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="告诉我们怎么称呼你"
                className="w-full px-4 py-3 rounded-xl border border-secondary dark:border-darkBorder bg-white/50 dark:bg-darkCard/50 text-onSurface dark:text-foreground placeholder-onSurface/40 dark:placeholder-foreground/30 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all duration-200"
              />
            </div>

            <div>
              <label
                htmlFor="input-message"
                className="block text-xs font-semibold text-onSurface/70 dark:text-foreground/70 uppercase tracking-wider mb-2"
              >
                申请说明（可选）
              </label>
              <textarea
                id="input-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="可以简单介绍一下你希望如何使用 Lumino"
                rows={4}
                className="w-full px-4 py-3 rounded-xl border border-secondary dark:border-darkBorder bg-white/50 dark:bg-darkCard/50 text-onSurface dark:text-foreground placeholder-onSurface/40 dark:placeholder-foreground/30 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all duration-200 resize-none"
              />
            </div>

            <Button type="submit" isLoading={isLoading} className="w-full py-3">
              提交申请
            </Button>
          </form>

          <div className="text-center mt-6">
            <p className="text-sm text-onSurface/60 dark:text-foreground/60">
              已经拿到邀请码？
              <Link href="/register" className="text-primary hover:underline font-semibold ml-1">
                前往注册
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
