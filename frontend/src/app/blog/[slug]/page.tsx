'use client'

import React, { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Calendar, User, Eye, Tag, Loader2, BookOpen } from 'lucide-react'
import dynamic from 'next/dynamic'
import api from '@/lib/api'
import ThemeToggle from '@/components/layout/ThemeToggle'
import { useTheme } from '@/hooks/useTheme'

// Import markdown preview dynamically to bypass hydration issues in SSR
const MDPreview = dynamic(
  () => import('@uiw/react-markdown-preview').then((mod) => mod.default),
  { ssr: false }
)

import '@uiw/react-markdown-preview/markdown.css'

interface UserResponse {
  id: number
  username: string
  display_name: string | null
}

interface BlogPost {
  id: number
  title: string
  slug: string
  content: string
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

export default function BlogPostDetail() {
  const params = useParams()
  const router = useRouter()
  const slug = params.slug as string
  const { isDark } = useTheme()

  const [post, setPost] = useState<BlogPost | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchPostDetail = async () => {
    try {
      const res = await api.get(`/blog/posts/${slug}`)
      setPost(res.data)
    } catch (err: any) {
      setError(err.response?.data?.detail || '无法获取文章内容或文章不存在。')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (slug) {
      fetchPostDetail()
    }
  }, [slug])

  if (loading) {
    return (
      <div className="min-h-screen bg-surface dark:bg-darkBg flex items-center justify-center">
        <Loader2 className="animate-spin text-primary h-8 w-8" />
      </div>
    )
  }

  if (error || !post) {
    return (
      <div className="min-h-screen bg-surface dark:bg-darkBg flex flex-col items-center justify-center space-y-4 px-6 text-center">
        <p className="text-red-500 font-semibold text-lg max-w-md">{error || '文章未找到'}</p>
        <Link href="/blog">
          <button className="px-5 py-2.5 rounded-xl bg-primary text-white font-medium hover:bg-primary/95 transition-colors">
            返回文章列表
          </button>
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface dark:bg-darkBg transition-colors duration-300 flex flex-col">
      {/* Header */}
      <header className="w-full border-b border-secondary dark:border-darkBorder bg-white/50 dark:bg-darkCard/50 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Link href="/blog" className="text-primary hover:text-primary/80 transition-colors flex items-center gap-1 text-sm font-medium">
              <ArrowLeft size={16} />
              <span>所有文章</span>
            </Link>
          </div>
          <div className="flex items-center space-x-4">
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Hero Cover Banner */}
      {post.cover_url && (
        <div className="w-full max-h-[360px] h-[40vh] relative overflow-hidden bg-secondary dark:bg-darkBg border-b border-secondary dark:border-darkBorder">
          <img
            src={post.cover_url}
            alt={post.title}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {/* Article Content Layout */}
      <main className="max-w-4xl mx-auto px-6 py-10 w-full flex-1 space-y-8">
        {/* Title and Metadata */}
        <div className="space-y-4 border-b border-secondary dark:border-darkBorder pb-6">
          {post.tags && post.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {post.tags.map((tag, tIdx) => (
                <span
                  key={tIdx}
                  className="inline-flex items-center text-xs font-semibold px-3 py-1 rounded-full bg-secondary/80 text-primary dark:bg-darkBorder dark:text-primary"
                >
                  <Tag size={10} className="mr-1" />
                  {tag}
                </span>
              ))}
            </div>
          )}

          <h1 className="text-3xl md:text-4xl font-display font-bold text-onSurface dark:text-foreground leading-tight">
            {post.title}
          </h1>

          {/* Author/Date/Views */}
          <div className="flex flex-wrap items-center gap-4 text-xs md:text-sm text-onSurface/55 dark:text-foreground/55">
            <span className="flex items-center gap-1.5 font-medium">
              <User size={14} className="text-primary" />
              {post.author?.display_name || post.author?.username}
            </span>
            <span>·</span>
            <span className="flex items-center gap-1.5">
              <Calendar size={14} />
              {post.published_at ? new Date(post.published_at).toLocaleString() : '未发布'}
            </span>
            <span>·</span>
            <span className="flex items-center gap-1.5">
              <Eye size={14} />
              阅读量: {post.view_count}
            </span>
          </div>
        </div>

        {/* Excerpt if exists */}
        {post.excerpt && (
          <div className="p-5 rounded-2xl bg-secondary/30 dark:bg-darkBorder/20 border-l-4 border-primary text-sm text-onSurface/75 dark:text-foreground/75 leading-relaxed italic">
            <strong>摘要:</strong> {post.excerpt}
          </div>
        )}

        {/* Markdown Reader Body */}
        <div className="flex flex-col overflow-hidden bg-transparent" data-color-mode={isDark ? 'dark' : 'light'}>
          <div className="prose dark:prose-invert max-w-none text-onSurface dark:text-foreground">
            <MDPreview source={post.content} />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full py-8 text-center border-t border-secondary dark:border-darkBorder bg-white/20 dark:bg-darkCard/20 mt-12">
        <p className="text-xs text-onSurface/40 dark:text-foreground/40 flex items-center justify-center gap-1">
          <BookOpen size={12} className="text-primary" />
          <span>Lumino Blog · 探索属于内心的宁静</span>
        </p>
      </footer>
    </div>
  )
}
