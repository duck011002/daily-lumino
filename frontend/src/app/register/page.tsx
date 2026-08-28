'use client'

import React, { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import ThemeToggle from '@/components/layout/ThemeToggle'
import LanguageToggle from '@/components/layout/LanguageToggle'
import Logo from '@/components/layout/Logo'
import Button from '@/components/ui/Button'
import { useAuth } from '@/hooks/useAuth'
import { useLanguage } from '@/hooks/useLanguage'

function RegisterForm() {
  const searchParams = useSearchParams()
  const { t } = useLanguage()
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const { register } = useAuth()

  const presetEmail = searchParams.get('email') || ''
  const presetInviteCode = searchParams.get('invite_code') || ''

  useEffect(() => {
    if (presetEmail) {
      setEmail(presetEmail)
    }
    if (presetInviteCode) {
      setInviteCode(presetInviteCode)
    }
  }, [presetEmail, presetInviteCode])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')

    if (
      !username.trim() ||
      !email.trim() ||
      !password.trim() ||
      !confirmPassword.trim() ||
      !inviteCode.trim()
    ) {
      setErrorMsg(t.auth.fillRequired)
      return
    }

    if (username.trim().length < 3) {
      setErrorMsg(t.auth.errUsernameLen)
      return
    }

    if (password.length < 8) {
      setErrorMsg(t.auth.errPasswordLen)
      return
    }

    if (password !== confirmPassword) {
      setErrorMsg(t.auth.errPasswordMatch)
      return
    }

    setIsLoading(true)
    try {
      await register({
        username: username.trim(),
        email: email.trim(),
        password,
        display_name: displayName.trim() || null,
        invite_code: inviteCode.trim(),
      })
    } catch (err: any) {
      setErrorMsg(err.message || t.auth.registerFailed)
      setIsLoading(false)
    }
  }

  return (
    <div className="flex-1 min-h-screen bg-surface dark:bg-darkBg flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden transition-colors duration-300">
      <div className="absolute top-[10%] left-[20%] w-[35%] h-[35%] bg-primary/10 rounded-full blur-[80px] pointer-events-none" />
      <div className="absolute bottom-[10%] right-[20%] w-[35%] h-[35%] bg-primary/5 rounded-full blur-[80px] pointer-events-none" />

      <div className="absolute top-6 right-6 z-20 flex items-center gap-2">
        <LanguageToggle />
        <ThemeToggle />
      </div>

      <div className="w-full max-w-md z-10">
        <div className="glassmorphism p-8 md:p-10 rounded-3xl shadow-xl transition-all duration-300">
          <div className="text-center mb-8 flex flex-col items-center">
            <Link href="/" className="inline-flex justify-center">
              <Logo size={36} textSize="text-3xl" />
            </Link>
            <h2 className="text-xl font-bold text-onSurface dark:text-foreground mt-4">
              {t.auth.openPrivateLife}
            </h2>
            <p className="text-xs text-onSurface/60 dark:text-foreground/60 mt-1">
              {t.auth.openPrivateLifeDesc}
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
                {t.auth.username} <span className="text-red-500">*</span>
              </label>
              <input
                id="input-username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={t.auth.usernameTip}
                className="w-full px-4 py-3 rounded-xl border border-secondary dark:border-darkBorder bg-white/50 dark:bg-darkCard/50 text-onSurface dark:text-foreground placeholder-onSurface/40 dark:placeholder-foreground/30 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all duration-200"
                required
              />
            </div>

            <div>
              <label
                htmlFor="input-email"
                className="block text-xs font-semibold text-onSurface/70 dark:text-foreground/70 uppercase tracking-wider mb-2"
              >
                {t.auth.email} <span className="text-red-500">*</span>
              </label>
              <input
                id="input-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t.auth.emailTip}
                readOnly={Boolean(presetEmail)}
                className="w-full px-4 py-3 rounded-xl border border-secondary dark:border-darkBorder bg-white/50 dark:bg-darkCard/50 text-onSurface dark:text-foreground placeholder-onSurface/40 dark:placeholder-foreground/30 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all duration-200 read-only:opacity-80"
                required
              />
            </div>

            <div>
              <label
                htmlFor="input-displayname"
                className="block text-xs font-semibold text-onSurface/70 dark:text-foreground/70 uppercase tracking-wider mb-2"
              >
                {t.auth.displayNameLabel}
              </label>
              <input
                id="input-displayname"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={t.auth.displayNameTip}
                className="w-full px-4 py-3 rounded-xl border border-secondary dark:border-darkBorder bg-white/50 dark:bg-darkCard/50 text-onSurface dark:text-foreground placeholder-onSurface/40 dark:placeholder-foreground/30 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all duration-200"
              />
            </div>

            <div>
              <label
                htmlFor="input-password"
                className="block text-xs font-semibold text-onSurface/70 dark:text-foreground/70 uppercase tracking-wider mb-2"
              >
                {t.auth.password} <span className="text-red-500">*</span>
              </label>
              <input
                id="input-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t.auth.passwordTip}
                className="w-full px-4 py-3 rounded-xl border border-secondary dark:border-darkBorder bg-white/50 dark:bg-darkCard/50 text-onSurface dark:text-foreground placeholder-onSurface/40 dark:placeholder-foreground/30 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all duration-200"
                required
              />
            </div>

            <div>
              <label
                htmlFor="input-confirm-password"
                className="block text-xs font-semibold text-onSurface/70 dark:text-foreground/70 uppercase tracking-wider mb-2"
              >
                {t.auth.confirmPassword} <span className="text-red-500">*</span>
              </label>
              <input
                id="input-confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder={t.auth.confirmPasswordTip}
                className="w-full px-4 py-3 rounded-xl border border-secondary dark:border-darkBorder bg-white/50 dark:bg-darkCard/50 text-onSurface dark:text-foreground placeholder-onSurface/40 dark:placeholder-foreground/30 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all duration-200"
                required
              />
            </div>

            <div>
              <label
                htmlFor="input-invitecode"
                className="block text-xs font-semibold text-onSurface/70 dark:text-foreground/70 uppercase tracking-wider mb-2"
              >
                {t.auth.inviteCode} <span className="text-red-500">*</span>
              </label>
              <input
                id="input-invitecode"
                type="text"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                placeholder={t.auth.inviteCodePlaceholder}
                className="w-full px-4 py-3 rounded-xl border border-secondary dark:border-darkBorder bg-white/50 dark:bg-darkCard/50 text-onSurface dark:text-foreground placeholder-onSurface/40 dark:placeholder-foreground/30 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all duration-200"
                required
              />
              <p className="mt-2 text-xs text-onSurface/60 dark:text-foreground/60">
                {t.auth.noInviteCode}
                <Link href="/invite-request" className="text-primary hover:underline ml-1">
                  {t.auth.applyNow}
                </Link>
              </p>
            </div>

            <Button id="btn-register-submit" type="submit" isLoading={isLoading} className="w-full py-3">
              {isLoading ? t.auth.registering : t.auth.registerBtn}
            </Button>
          </form>

          <div className="text-center mt-6">
            <p className="text-sm text-onSurface/60 dark:text-foreground/60">
              {t.auth.hasAccount}
              <Link href="/login" passHref>
                <span
                  id="link-to-login"
                  className="text-primary hover:underline font-semibold cursor-pointer ml-1"
                >
                  {t.auth.goToLogin}
                </span>
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Register() {
  return (
    <Suspense fallback={null}>
      <RegisterForm />
    </Suspense>
  )
}
