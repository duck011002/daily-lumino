'use client'

import React from 'react'
import Link from 'next/link'
import { LogOut, Sparkles, FolderHeart, Newspaper, ShieldAlert, User, Settings } from 'lucide-react'
import ThemeToggle from '@/components/layout/ThemeToggle'
import Button from '@/components/ui/Button'
import { useAuth } from '@/hooks/useAuth'

export default function Dashboard() {
  const { user, loading, logout } = useAuth()

  if (loading) {
    return (
      <div className="flex-1 min-h-screen bg-surface dark:bg-darkBg flex items-center justify-center text-primary font-medium">
        正在加载空间信息...
      </div>
    )
  }

  if (!user) return null // Handled by AuthProvider redirect

  const cards = [
    {
      id: 'btn-ai-chat',
      title: 'AI 智能对话',
      desc: '与你的专属多模态 AI 伴侣倾心倾诉，提供智能支持。',
      href: '/chat',
      icon: Sparkles,
      color: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20 hover:border-indigo-500/50',
    },
    {
      id: 'btn-spaces',
      title: '我的私密空间',
      desc: '进入专属的情侣、挚友或家庭加密空间，共同记录生活日常。',
      href: '/spaces',
      icon: FolderHeart,
      color: 'bg-primary/10 text-primary border-primary/20 hover:border-primary/50',
    },
    {
      id: 'btn-blog',
      title: '个人公开博客',
      desc: '书写你的思绪与洞察，并在极简博客中分享与发布。',
      href: '/blog',
      icon: Newspaper,
      color: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:border-emerald-500/50',
    },
  ]

  return (
    <div className="flex-1 min-h-screen bg-surface dark:bg-darkBg transition-colors duration-300">
      {/* Header */}
      <header className="w-full border-b border-secondary dark:border-darkBorder bg-white/50 dark:bg-darkCard/50 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Link href="/" passHref>
              <span className="font-display text-xl font-bold tracking-wide text-primary cursor-pointer">
                Lumino
              </span>
            </Link>
            <span className="text-xs bg-secondary text-primary px-2.5 py-0.5 rounded-full font-semibold dark:bg-secondary/10">
              工作台
            </span>
          </div>

          <div className="flex items-center space-x-4">
            <ThemeToggle />
            <Button
              id="btn-logout"
              variant="outline"
              size="sm"
              onClick={logout}
              className="flex items-center border-red-500/30 text-red-500 hover:bg-red-500/10"
            >
              <LogOut className="h-4 w-4 mr-1" />
              退出
            </Button>
          </div>
        </div>
      </header>

      {/* Main dashboard content */}
      <main className="max-w-7xl mx-auto px-6 py-12 space-y-12">
        {/* Welcome Section */}
        <section className="flex flex-col md:flex-row md:items-center justify-between gap-6 p-8 rounded-3xl bg-white/50 dark:bg-darkCard/50 border border-secondary dark:border-darkBorder shadow-sm">
          <div className="flex items-center space-x-4">
            <div className="h-16 w-16 rounded-full bg-secondary dark:bg-darkBorder flex items-center justify-center text-primary">
              {user.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.avatar_url}
                  alt={user.display_name || user.username}
                  className="h-16 w-16 rounded-full object-cover"
                />
              ) : (
                <User className="h-8 w-8" />
              )}
            </div>
            <div>
              <h2 className="text-2xl font-bold text-onSurface dark:text-foreground">
                你好，{user.display_name || user.username}！
              </h2>
              <p className="text-sm text-onSurface/60 dark:text-foreground/60 mt-0.5">
                欢迎回到 Lumino，今天是你开启私密生活的第 1 天。
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <span className="text-xs flex items-center px-3 py-1.5 rounded-full font-medium bg-secondary text-primary dark:bg-secondary/10">
              邮箱：{user.email}
            </span>
            {user.is_root ? (
              <span className="text-xs flex items-center px-3 py-1.5 rounded-full font-medium bg-red-500/10 text-red-500">
                <ShieldAlert className="h-3.5 w-3.5 mr-1" />
                超级管理员
              </span>
            ) : null}
          </div>
        </section>

        {/* Superadmin Card if user.is_root */}
        {user.is_root ? (
          <section className="animate-fade-in">
            <div className="p-8 rounded-3xl border border-red-500/20 bg-red-500/[0.03] flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-red-500 flex items-center">
                  <ShieldAlert className="h-5 w-5 mr-2" />
                  系统超级管理控制台
                </h3>
                <p className="text-sm text-onSurface/70 dark:text-foreground/70">
                  作为管理员，您可以进行用户管理、修改系统 API Key（通义千问 / DeepSeek）与 Lsky 存储配额。
                </p>
              </div>
              <Link href="/admin" passHref>
                <Button
                  id="btn-admin-panel"
                  className="bg-red-500 hover:bg-red-600 text-white shrink-0"
                >
                  <Settings className="h-4 w-4 mr-2" />
                  进入后台管理
                </Button>
              </Link>
            </div>
          </section>
        ) : null}

        {/* Modules Cards Grid */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {cards.map((card, idx) => (
            <Link key={idx} href={card.href} passHref>
              <div
                id={card.id}
                className="p-8 rounded-3xl border bg-white dark:bg-darkCard hover:shadow-lg transition-all duration-300 hover:translate-y-[-4px] cursor-pointer flex flex-col h-full border-secondary dark:border-darkBorder"
              >
                <div className={`h-12 w-12 rounded-2xl flex items-center justify-center mb-6 ${card.color}`}>
                  <card.icon className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-bold text-onSurface dark:text-foreground mb-3">
                  {card.title}
                </h3>
                <p className="text-onSurface/70 dark:text-foreground/70 text-sm leading-relaxed flex-1">
                  {card.desc}
                </p>
                <div className="text-primary font-semibold text-sm flex items-center mt-6 group">
                  立即开始
                  <svg
                    className="h-4 w-4 ml-1 transition-transform duration-200 group-hover:translate-x-1"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </div>
              </div>
            </Link>
          ))}
        </section>
      </main>
    </div>
  )
}
