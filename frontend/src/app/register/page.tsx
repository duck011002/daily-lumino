'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import Button from '@/components/ui/Button'
import ThemeToggle from '@/components/layout/ThemeToggle'

export default function Register() {
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const { register } = useAuth()
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')

    if (!username.trim() || !email.trim() || !password.trim() || !confirmPassword.trim() || !inviteCode.trim()) {
      setErrorMsg('请填写所有必填字段。')
      return
    }

    if (username.trim().length < 3) {
      setErrorMsg('用户名长度不能少于 3 个字符。')
      return
    }

    if (password.length < 8) {
      setErrorMsg('密码长度不能少于 8 位。')
      return
    }

    if (password !== confirmPassword) {
      setErrorMsg('两次输入的密码不一致。')
      return
    }

    setIsLoading(true)
    try {
      await register({
        username: username.trim(),
        email: email.trim(),
        password: password,
        display_name: displayName.trim() || null,
        invite_code: inviteCode.trim() || null,
      })
    } catch (err: any) {
      setErrorMsg(err.message || '注册失败，请检查填写项并重试。')
      setIsLoading(false)
    }
  }

  return (
    <div className="flex-1 min-h-screen bg-surface dark:bg-darkBg flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden transition-colors duration-300">
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
              开启私密生活
            </h2>
            <p className="text-xs text-onSurface/60 dark:text-foreground/60 mt-1">
              创建您的专属加密避风港账户
            </p>
          </div>

          {errorMsg ? (
            <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
              {errorMsg}
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="input-username"
                className="block text-xs font-semibold text-onSurface/70 dark:text-foreground/70 uppercase tracking-wider mb-2"
              >
                用户名 <span className="text-red-500">*</span>
              </label>
              <input
                id="input-username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="请输入用户名（用于登录）"
                className="w-full px-4 py-3 rounded-xl border border-secondary dark:border-darkBorder bg-white/50 dark:bg-darkCard/50 text-onSurface dark:text-foreground placeholder-onSurface/40 dark:placeholder-foreground/30 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all duration-200"
                required
              />
            </div>

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
                placeholder="请输入您的电子邮箱"
                className="w-full px-4 py-3 rounded-xl border border-secondary dark:border-darkBorder bg-white/50 dark:bg-darkCard/50 text-onSurface dark:text-foreground placeholder-onSurface/40 dark:placeholder-foreground/30 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all duration-200"
                required
              />
            </div>

            <div>
              <label
                htmlFor="input-displayname"
                className="block text-xs font-semibold text-onSurface/70 dark:text-foreground/70 uppercase tracking-wider mb-2"
              >
                显示昵称 (可选)
              </label>
              <input
                id="input-displayname"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="空间中显示的名字"
                className="w-full px-4 py-3 rounded-xl border border-secondary dark:border-darkBorder bg-white/50 dark:bg-darkCard/50 text-onSurface dark:text-foreground placeholder-onSurface/40 dark:placeholder-foreground/30 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all duration-200"
              />
            </div>

            <div>
              <label
                htmlFor="input-password"
                className="block text-xs font-semibold text-onSurface/70 dark:text-foreground/70 uppercase tracking-wider mb-2"
              >
                密码 <span className="text-red-500">*</span>
              </label>
              <input
                id="input-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="至少 8 位安全密码"
                className="w-full px-4 py-3 rounded-xl border border-secondary dark:border-darkBorder bg-white/50 dark:bg-darkCard/50 text-onSurface dark:text-foreground placeholder-onSurface/40 dark:placeholder-foreground/30 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all duration-200"
                required
              />
            </div>

            <div>
              <label
                htmlFor="input-confirm-password"
                className="block text-xs font-semibold text-onSurface/70 dark:text-foreground/70 uppercase tracking-wider mb-2"
              >
                确认密码 <span className="text-red-500">*</span>
              </label>
              <input
                id="input-confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="请再次输入您的密码"
                className="w-full px-4 py-3 rounded-xl border border-secondary dark:border-darkBorder bg-white/50 dark:bg-darkCard/50 text-onSurface dark:text-foreground placeholder-onSurface/40 dark:placeholder-foreground/30 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all duration-200"
                required
              />
            </div>

            <div>
              <label
                htmlFor="input-invitecode"
                className="block text-xs font-semibold text-onSurface/70 dark:text-foreground/70 uppercase tracking-wider mb-2"
              >
                邀请码 <span className="text-red-500">*</span>
              </label>
              <input
                id="input-invitecode"
                type="text"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                placeholder="请输入注册邀请码"
                className="w-full px-4 py-3 rounded-xl border border-secondary dark:border-darkBorder bg-white/50 dark:bg-darkCard/50 text-onSurface dark:text-foreground placeholder-onSurface/40 dark:placeholder-foreground/30 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all duration-200"
                required
              />
            </div>

            <Button
              id="btn-register-submit"
              type="submit"
              isLoading={isLoading}
              className="w-full py-3"
            >
              注 册
            </Button>
          </form>

          <div className="text-center mt-6">
            <p className="text-sm text-onSurface/60 dark:text-foreground/60">
              已有账户？{' '}
              <Link href="/login" passHref>
                <span
                  id="link-to-login"
                  className="text-primary hover:underline font-semibold cursor-pointer"
                >
                  前往登录
                </span>
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
