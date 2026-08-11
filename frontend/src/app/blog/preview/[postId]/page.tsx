'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, EyeOff, Loader2, LockKeyhole } from 'lucide-react'
import api from '@/lib/api'
import SiteNav from '@/components/layout/SiteNav'
import { useAuth } from '@/hooks/useAuth'
import { useTheme } from '@/hooks/useTheme'

const MDPreview = dynamic(
  () => import('@uiw/react-markdown-preview').then((mod) => mod.default),
  { ssr: false }
)

import '@uiw/react-markdown-preview/markdown.css'

interface BlogPost {
  id: number
  title: string
  content: string
  excerpt: string | null
  cover_url: string | null
  tags: string[] | null
  is_public: boolean
  is_published: boolean
}

export default function PrivateBlogPreviewPage() {
  const params = useParams()
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const { isDark } = useTheme()
  const postId = params.postId as string
  const [post, setPost] = useState<BlogPost | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login')
  }, [authLoading, router, user])

  useEffect(() => {
    if (authLoading || !user) return
    if (!/^\d+$/.test(postId)) {
      setError('无效的文章编号。')
      setLoading(false)
      return
    }

    api.get(`/blog/me/posts/${postId}/preview`)
      .then((response) => setPost(response.data))
      .catch((requestError: any) => {
        setError(requestError.response?.data?.detail || '无法打开私密预览。')
      })
      .finally(() => setLoading(false))
  }, [authLoading, postId, user])

  if (authLoading || !user || loading) {
    return <div className="grid min-h-screen place-items-center bg-[#eef1eb] dark:bg-darkBg"><Loader2 className="h-8 w-8 animate-spin text-[#b56b19]" /></div>
  }

  if (error || !post) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#eef1eb] px-6 text-center dark:bg-darkBg">
        <div>
          <p className="text-lg font-semibold text-red-500">{error || '文章未找到'}</p>
          <Link href="/blog/manage" className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#163a2b] px-5 py-2.5 text-sm font-semibold text-white"><ArrowLeft size={15} />返回文章管理</Link>
        </div>
      </div>
    )
  }

  const stateLabel = post.is_public && post.is_published ? '已公开文章的私密预览' : '草稿私密预览'

  return (
    <div className="min-h-screen bg-[#eef1eb] text-[#17211d] dark:bg-darkBg dark:text-foreground">
      <SiteNav />
      <main className="mx-auto max-w-4xl px-4 py-6 md:px-8 md:py-8">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <Link href="/blog/manage" className="inline-flex items-center gap-2 text-sm font-semibold text-[#1d6347] transition hover:text-[#b56b19] dark:text-[#f7b84b]"><ArrowLeft size={16} />返回文章管理</Link>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#163a2b] px-3 py-1.5 text-xs font-bold text-white"><LockKeyhole size={13} />仅作者可见</span>
        </div>
        <article className="overflow-hidden rounded-[2rem] border border-[#17211d]/10 bg-[#fffdf8] shadow-[0_32px_90px_-48px_rgba(23,33,29,0.6)] dark:border-darkBorder dark:bg-darkCard">
          {post.cover_url && <div className="h-56 overflow-hidden md:h-80"><img src={post.cover_url} alt={post.title} className="h-full w-full object-cover" /></div>}
          <div className="px-6 py-9 md:px-12 md:py-14">
            <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-[#b56b19]"><EyeOff size={14} />{stateLabel}</p>
            <h1 className="mt-4 font-display text-3xl font-bold leading-tight md:text-5xl">{post.title}</h1>
            {post.excerpt && <aside className="mt-7 rounded-2xl border border-[#b56b19]/20 bg-[#fdf5e7] px-5 py-4 text-sm leading-7 text-[#5e482c] dark:bg-[#2e2518] dark:text-[#f7dfb8]"><strong className="mr-2">摘要</strong>{post.excerpt}</aside>}
            <div className="mt-8 border-t border-[#17211d]/10 pt-8 dark:border-darkBorder" data-color-mode={isDark ? 'dark' : 'light'}>
              <div className="prose max-w-none dark:prose-invert [&_.wmde-markdown]:!bg-transparent [&_.wmde-markdown]:!text-inherit"><MDPreview source={post.content} style={{ backgroundColor: 'transparent' }} /></div>
            </div>
          </div>
        </article>
      </main>
    </div>
  )
}
