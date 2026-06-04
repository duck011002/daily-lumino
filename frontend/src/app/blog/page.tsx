'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, BookOpen, Loader2, Calendar, User, Eye, ArrowRight, Tag } from 'lucide-react'
import api from '@/lib/api'
import ThemeToggle from '@/components/layout/ThemeToggle'
import Button from '@/components/ui/Button'

interface UserResponse {
  id: number
  username: string
  display_name: string | null
}

interface BlogPost {
  id: number
  title: string
  slug: string
  cover_url: string | null
  excerpt: string | null
  is_public: boolean
  is_published: boolean
  tags: string[] | null
  view_count: number
  published_at: string | null
  created_at: string
  author: UserResponse | null
}

export default function PublicBlogList() {
  const [posts, setPosts] = useState<BlogPost[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchPublicPosts = async () => {
    try {
      const res = await api.get('/blog/posts')
      setPosts(res.data)
    } catch (err: any) {
      setError(err.response?.data?.detail || '加载博客列表失败，请重试。')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPublicPosts()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-surface dark:bg-darkBg flex items-center justify-center">
        <Loader2 className="animate-spin text-primary h-8 w-8" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface dark:bg-darkBg transition-colors duration-300 flex flex-col relative overflow-hidden">
      {/* Background blur patterns */}
      <div className="absolute top-[-10%] left-[-15%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-15%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />

      {/* Header */}
      <header className="w-full border-b border-secondary dark:border-darkBorder bg-white/50 dark:bg-darkCard/50 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Link href="/dashboard" className="text-primary hover:text-primary/80 transition-colors flex items-center gap-1 text-sm font-medium">
              <ArrowLeft size={16} />
              <span>工作台</span>
            </Link>
            <span className="text-onSurface/20 dark:text-foreground/20">|</span>
            <span className="font-display font-bold text-lg text-primary tracking-wide">Lumino Blog</span>
          </div>
          <div className="flex items-center space-x-4">
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Hero Banner */}
      <section className="py-16 text-center max-w-4xl mx-auto px-6 space-y-4">
        <h1 className="text-4xl md:text-5xl font-display font-bold text-onSurface dark:text-foreground">
          生活随笔 & 情感留白
        </h1>
        <p className="text-sm md:text-base text-onSurface/60 dark:text-foreground/60 max-w-xl mx-auto leading-relaxed">
          在这里，我们倾听岁月的回响，用文字书写那些静谧、热烈而真挚的生活印记。
        </p>
      </section>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-6 pb-20 flex-1 w-full">
        {error && (
          <div className="p-4 rounded-xl bg-red-50 dark:bg-red-500/10 text-red-500 border border-red-200 dark:border-red-500/20 text-center max-w-md mx-auto">
            {error}
          </div>
        )}

        {posts.length === 0 ? (
          <div className="text-center py-20 space-y-4">
            <div className="inline-flex h-16 w-16 rounded-3xl bg-primary/10 text-primary items-center justify-center font-bold">
              <BookOpen size={24} />
            </div>
            <h3 className="text-xl font-bold text-onSurface dark:text-foreground">静候花开</h3>
            <p className="text-sm text-onSurface/60 dark:text-foreground/60 max-w-sm mx-auto">
              目前还没有公开的文章。超级管理员可登录控制台发布第一篇公开随笔。
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {posts.map((post) => (
              <article
                key={post.id}
                className="group rounded-3xl overflow-hidden border border-secondary dark:border-darkBorder bg-white dark:bg-darkCard hover:shadow-xl transition-all duration-300 hover:translate-y-[-4px] flex flex-col h-full"
              >
                {/* Cover Image */}
                <div className="aspect-[16/10] bg-secondary dark:bg-darkBg relative overflow-hidden">
                  {post.cover_url ? (
                    <img
                      src={post.cover_url}
                      alt={post.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-onSurface/20 dark:text-foreground/20 group-hover:text-primary/30 transition-colors">
                      <BookOpen size={48} />
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="p-6 flex flex-col justify-between flex-1 space-y-4">
                  <div className="space-y-3">
                    {/* Tags */}
                    {post.tags && post.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {post.tags.map((tag, tIdx) => (
                          <span
                            key={tIdx}
                            className="inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full bg-secondary/60 text-primary/95 dark:bg-darkBorder dark:text-primary"
                          >
                            <Tag size={8} className="mr-1" />
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}

                    <h2 className="text-xl font-bold text-onSurface dark:text-foreground line-clamp-2 leading-tight group-hover:text-primary transition-colors">
                      <Link href={`/blog/${post.slug}`}>
                        {post.title}
                      </Link>
                    </h2>

                    <p className="text-xs text-onSurface/60 dark:text-foreground/60 line-clamp-3 leading-relaxed">
                      {post.excerpt || '暂无文章摘要...'}
                    </p>
                  </div>

                  <div className="border-t border-secondary/50 dark:border-darkBorder/50 pt-4 flex items-center justify-between text-xs text-onSurface/40 dark:text-foreground/40">
                    <div className="flex items-center space-x-3">
                      <span className="flex items-center gap-1">
                        <User size={12} />
                        {post.author?.display_name || post.author?.username}
                      </span>
                      <span>·</span>
                      <span className="flex items-center gap-1">
                        <Calendar size={12} />
                        {post.published_at ? new Date(post.published_at).toLocaleDateString() : '未发布'}
                      </span>
                    </div>

                    <span className="flex items-center gap-1">
                      <Eye size={12} />
                      {post.view_count}
                    </span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
