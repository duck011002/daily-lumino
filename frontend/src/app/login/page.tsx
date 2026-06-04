'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import Button from '@/components/ui/Button'
import ThemeToggle from '@/components/layout/ThemeToggle'

export default function Login() {
  const [usernameOrEmail, setUsernameOrEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const { login } = useAuth()
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')
    if (!usernameOrEmail.trim() || !password.trim()) {
      setErrorMsg('请填写所有必填字段。')
      return
    }

    setIsLoading(true)
    try {
      await login(usernameOrEmail, password)
    } catch (err: any) {
      setErrorMsg(err.message || '登录失败，请重试。')
      setIsLoading(false)
    }
  }

  return (
    <div className="flex-1 min-h-screen bg-surface dark:bg-darkBg flex flex-col justify-center items-center px-4 relative overflow-hidden transition-colors duration-300">
      {/* Background blobs */}
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
              欢迎回来
            </h2>
            <p className="text-xs text-onSurface/60 dark:text-foreground/60 mt-1">
              请登录您的私密空间账户
            </p>
          </div>

          {errorMsg ? (
            <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
              {errorMsg}
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label
                htmlFor="input-username"
                className="block text-xs font-semibold text-onSurface/70 dark:text-foreground/70 uppercase tracking-wider mb-2"
              >
                用户名或邮箱地址
              </label>
              <input
                id="input-username"
                type="text"
                value={usernameOrEmail}
                onChange={(e) => setUsernameOrEmail(e.target.value)}
                placeholder="请输入用户名或邮箱"
                className="w-full px-4 py-3 rounded-xl border border-secondary dark:border-darkBorder bg-white/50 dark:bg-darkCard/50 text-onSurface dark:text-foreground placeholder-onSurface/40 dark:placeholder-foreground/30 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all duration-200"
                required
              />
            </div>

            <div>
              <label
                htmlFor="input-password"
                className="block text-xs font-semibold text-onSurface/70 dark:text-foreground/70 uppercase tracking-wider mb-2"
              >
                密码
              </label>
              <input
                id="input-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="请输入密码"
                className="w-full px-4 py-3 rounded-xl border border-secondary dark:border-darkBorder bg-white/50 dark:bg-darkCard/50 text-onSurface dark:text-foreground placeholder-onSurface/40 dark:placeholder-foreground/30 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all duration-200"
                required
              />
            </div>

            <Button
              id="btn-login-submit"
              type="submit"
              isLoading={isLoading}
              className="w-full py-3"
            >
              登录
            </Button>
          </form>

          <div className="text-center mt-6 space-y-3">
            <p className="text-sm text-onSurface/60 dark:text-foreground/60">
              还没有账户？{' '}
              <Link href="/register" passHref>
                <span
                  id="link-to-register"
                  className="text-primary hover:underline font-semibold cursor-pointer"
                >
                  立即注册
                </span>
              </Link>
            </p>
            <div className="pt-3 border-t border-secondary dark:border-darkBorder">
              <Link href="/blog" passHref>
                <span
                  id="link-to-blog-visitor"
                  className="text-sm text-primary hover:underline font-medium cursor-pointer inline-flex items-center gap-1 transition-colors"
                >
                  游客模式：以游客身份浏览公开博客 →
                </span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
