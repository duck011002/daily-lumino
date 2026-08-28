'use client'

import { Suspense, useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2, Save, Send, ShieldAlert } from 'lucide-react'
import api from '@/lib/api'
import ThemeToggle from '@/components/layout/ThemeToggle'
import LanguageToggle from '@/components/layout/LanguageToggle'
import { useAuth } from '@/hooks/useAuth'
import BackLink from '@/components/ui/BackLink'

const MDEditor = dynamic(() => import('@uiw/react-md-editor'), { ssr: false })

interface BlogCategory {
  id: number
  name: string
  slug: string
}

interface EditableBlogPost {
  id: number
  title: string
  slug: string
  excerpt: string | null
  content: string
  category: BlogCategory | null
  tags: string[] | null
  cover_url: string | null
  is_public: boolean
  is_published: boolean
}

const emptyPost = { title: '', slug: '', excerpt: '', content: '', category_id: '', tags: '', cover_url: '' }

export default function BlogWriter() {
  return <Suspense fallback={<WriterLoading />}><BlogWriterContent /></Suspense>
}

function BlogWriterContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, loading: authLoading } = useAuth()
  const [categories, setCategories] = useState<BlogCategory[]>([])
  const [form, setForm] = useState(emptyPost)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [loadingPost, setLoadingPost] = useState(false)
  const canWrite = Boolean(user?.is_root || user?.can_write_blog)
  const postId = searchParams.get('postId')
  const isEditing = Boolean(postId)

  useEffect(() => {
    if (!authLoading && !canWrite) router.replace('/blog')
  }, [authLoading, canWrite, router])

  useEffect(() => {
    api.get('/blog/categories').then((res) => setCategories(res.data)).catch(() => setCategories([]))
  }, [])

  useEffect(() => {
    if (!canWrite || !postId) return
    const loadPost = async () => {
      setLoadingPost(true)
      try {
        const response = await api.get('/blog/me/posts')
        const post = response.data.find((item: EditableBlogPost) => item.id === Number(postId)) as EditableBlogPost | undefined
        if (!post) {
          setMessage('没有找到这篇文章，或你没有管理权限。')
          return
        }
        setForm({
          title: post.title,
          slug: post.slug,
          excerpt: post.excerpt || '',
          content: post.content,
          category_id: post.category ? String(post.category.id) : '',
          tags: post.tags?.join(', ') || '',
          cover_url: post.cover_url || '',
        })
      } catch (err: any) {
        setMessage(err.response?.data?.detail || '文章加载失败，请稍后重试。')
      } finally {
        setLoadingPost(false)
      }
    }
    loadPost()
  }, [canWrite, postId])

  const save = async (publish: boolean) => {
    if (!form.title.trim() || !form.slug.trim() || !form.content.trim()) {
      setMessage('请填写标题、标识链接和正文。')
      return
    }
    setSaving(true)
    setMessage('')
    try {
      const payload = {
        title: form.title.trim(),
        slug: form.slug.trim(),
        content: form.content,
        excerpt: form.excerpt.trim() || null,
        cover_url: form.cover_url.trim() || null,
        category_id: form.category_id ? Number(form.category_id) : null,
        tags: form.tags.split(',').map((tag) => tag.trim()).filter(Boolean),
        is_public: publish,
        is_published: publish,
      }
      if (postId) {
        await api.patch(`/blog/me/posts/${postId}`, payload)
      } else {
        await api.post('/blog/me/posts', payload)
      }
      router.push('/blog/manage')
    } catch (err: any) {
      setMessage(err.response?.data?.detail || '保存失败，请稍后重试。')
    } finally {
      setSaving(false)
    }
  }

  if (authLoading || !canWrite || loadingPost) return <div className="grid min-h-screen place-items-center bg-[#f6f4ee] dark:bg-darkBg"><Loader2 className="h-7 w-7 animate-spin text-[#b56b19]" /></div>

  return <div className="min-h-screen bg-[#f6f4ee] text-[#17211d] dark:bg-darkBg dark:text-foreground">
    <header className="sticky top-0 z-30 border-b border-[#17211d]/10 bg-[#f6f4ee]/90 backdrop-blur dark:border-darkBorder dark:bg-darkBg/90">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 md:px-8">
        <BackLink href="/blog/manage" label="返回文章管理" />
        <div className="flex items-center gap-2">
          <LanguageToggle />
          <ThemeToggle />
        </div>
      </div>
    </header>
    <main className="mx-auto max-w-6xl px-5 py-10 md:px-8">
      <div className="mb-8 flex flex-col gap-3 md:flex-row md:items-end md:justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-[#b56b19]">Writer workspace</p><h1 className="mt-2 font-display text-3xl font-bold">{isEditing ? '编辑技术文章' : '新建技术文章'}</h1></div><p className="max-w-md text-sm leading-6 text-[#17211d]/55 dark:text-foreground/55">保存草稿后只有你能看到；公开发布后会出现在访客博客页。</p></div>
      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <section className="space-y-5 rounded-[1.5rem] border border-[#17211d]/10 bg-white p-5 dark:border-darkBorder dark:bg-darkCard md:p-7">
          <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="文章标题" className="w-full border-b border-[#17211d]/15 bg-transparent pb-4 font-display text-3xl font-bold outline-none placeholder:text-[#17211d]/25 dark:border-darkBorder dark:placeholder:text-foreground/25" />
          <MDEditor value={form.content} onChange={(value) => setForm({ ...form, content: value || '' })} height={520} preview="edit" />
        </section>
        <aside className="space-y-5 rounded-[1.5rem] border border-[#17211d]/10 bg-white p-5 dark:border-darkBorder dark:bg-darkCard">
          <Field label="标识链接"><input value={form.slug} onChange={(event) => setForm({ ...form, slug: event.target.value })} placeholder="my-agent-notes" className="writer-input" /></Field>
          <Field label="技术分区"><select value={form.category_id} onChange={(event) => setForm({ ...form, category_id: event.target.value })} className="writer-input"><option value="">未分类</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></Field>
          <Field label="摘要"><textarea value={form.excerpt} onChange={(event) => setForm({ ...form, excerpt: event.target.value })} rows={4} className="writer-input resize-none" /></Field>
          <Field label="标签（逗号分隔）"><input value={form.tags} onChange={(event) => setForm({ ...form, tags: event.target.value })} placeholder="agent, mcp, python" className="writer-input" /></Field>
          <Field label="封面图 URL"><input value={form.cover_url} onChange={(event) => setForm({ ...form, cover_url: event.target.value })} placeholder="https://..." className="writer-input" /></Field>
          {message && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-600 dark:bg-red-500/10">{message}</p>}
          <button disabled={saving} onClick={() => save(false)} className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#163a2b] px-4 py-3 text-sm font-bold text-[#163a2b] hover:bg-[#163a2b]/5 disabled:opacity-50 dark:border-[#f7b84b] dark:text-[#f7b84b]"><Save size={16} />保存草稿</button>
          <button disabled={saving} onClick={() => save(true)} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#163a2b] px-4 py-3 text-sm font-bold text-white hover:bg-[#24553f] disabled:opacity-50">{saving ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}公开发布</button>
          <p className="flex gap-2 text-xs leading-5 text-[#17211d]/45 dark:text-foreground/45"><ShieldAlert size={14} className="mt-0.5 shrink-0" />发布前请确认内容、图片链接和引用来源都适合公开展示。</p>
        </aside>
      </div>
    </main>
  </div>
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block space-y-2"><span className="text-xs font-bold uppercase tracking-[0.12em] text-[#17211d]/55 dark:text-foreground/55">{label}</span>{children}</label>
}

function WriterLoading() {
  return <div className="grid min-h-screen place-items-center bg-[#f6f4ee] dark:bg-darkBg"><Loader2 className="h-7 w-7 animate-spin text-[#b56b19]" /></div>
}
