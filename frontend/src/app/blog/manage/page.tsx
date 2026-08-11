'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Eye,
  FilePenLine,
  Globe2,
  LockKeyhole,
  Loader2,
  PenLine,
  Plus,
  Send,
  Star,
  Trash2,
} from 'lucide-react'
import api from '@/lib/api'
import ThemeToggle from '@/components/layout/ThemeToggle'
import { useAuth } from '@/hooks/useAuth'
import BackLink from '@/components/ui/BackLink'

interface BlogPost {
  id: number
  title: string
  slug: string
  excerpt: string | null
  is_public: boolean
  is_published: boolean
  is_featured: boolean
  author_id: number
  view_count: number
  updated_at: string
  author: { username: string; display_name: string | null } | null
  category: { name: string } | null
}

interface BlogCategory {
  id: number
  name: string
}

const formatDate = (value: string) =>
  new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(value))

export default function BlogManagementPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [posts, setPosts] = useState<BlogPost[]>([])
  const [categories, setCategories] = useState<BlogCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [actingId, setActingId] = useState<number | null>(null)
  const [categoryName, setCategoryName] = useState('')
  const [creatingCategory, setCreatingCategory] = useState(false)
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null)
  const [editingCategoryName, setEditingCategoryName] = useState('')
  const [categoryActionId, setCategoryActionId] = useState<number | null>(null)
  const [message, setMessage] = useState('')
  const canWrite = Boolean(user?.is_root || user?.can_write_blog)
  const isRoot = Boolean(user?.is_root)

  const loadPosts = async () => {
    setLoading(true)
    try {
      const response = await api.get('/blog/me/posts')
      setPosts(response.data)
    } catch (err: any) {
      setMessage(err.response?.data?.detail || '文章列表加载失败，请稍后重试。')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!authLoading && !canWrite) router.replace('/blog')
  }, [authLoading, canWrite, router])

  useEffect(() => {
    if (canWrite) loadPosts()
  }, [canWrite])

  useEffect(() => {
    if (!isRoot) return
    api.get('/admin/blog/categories').then((response) => setCategories(response.data)).catch(() => setCategories([]))
  }, [isRoot])

  const createCategory = async () => {
    const name = categoryName.trim()
    if (!name) {
      setMessage('请输入分区名称。')
      return
    }
    setCreatingCategory(true)
    setMessage('')
    try {
      const response = await api.post('/admin/blog/categories', { name })
      setCategories((current) => [...current, response.data])
      setCategoryName('')
    } catch (err: any) {
      setMessage(err.response?.data?.detail || '创建技术分区失败。')
    } finally {
      setCreatingCategory(false)
    }
  }

  const startEditingCategory = (category: BlogCategory) => {
    setEditingCategoryId(category.id)
    setEditingCategoryName(category.name)
    setMessage('')
  }

  const updateCategory = async (category: BlogCategory) => {
    const name = editingCategoryName.trim()
    if (!name) {
      setMessage('请输入分区名称。')
      return
    }
    if (name === category.name) {
      setEditingCategoryId(null)
      return
    }
    setCategoryActionId(category.id)
    setMessage('')
    try {
      const response = await api.patch('/admin/blog/categories/' + category.id, { name })
      setCategories((current) => current.map((item) => item.id === category.id ? response.data : item))
      setEditingCategoryId(null)
      setEditingCategoryName('')
    } catch (err: any) {
      setMessage(err.response?.data?.detail || '修改技术分区失败。')
    } finally {
      setCategoryActionId(null)
    }
  }

  const removeCategory = async (category: BlogCategory) => {
    if (!window.confirm('确定删除技术分区“' + category.name + '”吗？\n\n分区内的文章不会被删除，它们将自动归入“未分类”。')) return
    setCategoryActionId(category.id)
    setMessage('')
    try {
      await api.delete('/admin/blog/categories/' + category.id)
      setCategories((current) => current.filter((item) => item.id !== category.id))
      if (editingCategoryId === category.id) {
        setEditingCategoryId(null)
        setEditingCategoryName('')
      }
      await loadPosts()
    } catch (err: any) {
      setMessage(err.response?.data?.detail || '删除技术分区失败。')
    } finally {
      setCategoryActionId(null)
    }
  }

  const changePublication = async (post: BlogPost) => {
    setActingId(post.id)
    setMessage('')
    const willPublish = !(post.is_public && post.is_published)
    try {
      await api.patch(`/blog/me/posts/${post.id}`, {
        is_public: willPublish,
        is_published: willPublish,
      })
      await loadPosts()
    } catch (err: any) {
      setMessage(err.response?.data?.detail || '文章状态更新失败。')
    } finally {
      setActingId(null)
    }
  }

  const removePost = async (post: BlogPost) => {
    if (!window.confirm(`确定删除《${post.title}》吗？此操作无法恢复。`)) return
    setActingId(post.id)
    setMessage('')
    try {
      await api.delete(`/blog/me/posts/${post.id}`)
      setPosts((current) => current.filter((item) => item.id !== post.id))
    } catch (err: any) {
      setMessage(err.response?.data?.detail || '删除文章失败。')
    } finally {
      setActingId(null)
    }
  }

  const changeFeatured = async (post: BlogPost) => {
    setActingId(post.id)
    setMessage('')
    try {
      await api.patch(`/blog/me/posts/${post.id}`, { is_featured: !post.is_featured })
      await loadPosts()
    } catch (err: any) {
      setMessage(err.response?.data?.detail || '精选状态更新失败。')
    } finally {
      setActingId(null)
    }
  }

  if (authLoading || !canWrite) {
    return <div className="grid min-h-screen place-items-center bg-[#f6f4ee] dark:bg-darkBg"><Loader2 className="h-7 w-7 animate-spin text-[#b56b19]" /></div>
  }

  return (
    <div className="min-h-screen bg-[#f6f4ee] text-[#17211d] dark:bg-darkBg dark:text-foreground">
      <header className="sticky top-0 z-30 border-b border-[#17211d]/10 bg-[#f6f4ee]/90 backdrop-blur dark:border-darkBorder dark:bg-darkBg/90">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 md:px-8">
          <BackLink
            href={isRoot ? '/admin' : '/blog'}
            label={isRoot ? '返回管理后台' : '返回技术博客'}
          />
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-10 md:px-8">
        <section className="flex flex-col gap-5 border-b border-[#17211d]/10 pb-7 dark:border-darkBorder md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#b56b19]">Article management</p>
            <h1 className="mt-2 font-display text-3xl font-bold">{isRoot ? '全站文章管理' : '我的文章管理'}</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-[#17211d]/55 dark:text-foreground/55">{isRoot ? '你正在管理所有作者的文章。' : '管理你的草稿和已发布技术文章。'} 编辑不会自动公开内容，发布与撤回需要明确操作。</p>
          </div>
          <Link href="/blog/write" className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#163a2b] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#24553f]"><Plus size={17} />新建文章</Link>
        </section>

        {isRoot && <section className="mt-7 rounded-2xl border border-[#17211d]/10 bg-white p-5 dark:border-darkBorder dark:bg-darkCard">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#b56b19]">Blog sections</p><h2 className="mt-1 font-display text-xl font-bold">技术分区</h2><p className="mt-1 text-xs text-[#17211d]/50 dark:text-foreground/50">只填写访客看到的名称，系统会自动生成内部 URL 标识。</p></div><div className="flex w-full gap-2 md:w-auto"><input value={categoryName} onChange={(event) => setCategoryName(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') createCategory() }} placeholder="例如：深度学习" className="min-w-0 flex-1 rounded-xl border border-[#17211d]/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-[#163a2b] md:w-48 dark:border-darkBorder" /><button disabled={creatingCategory} onClick={createCategory} className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-[#163a2b] px-3 py-2 text-sm font-bold text-white disabled:opacity-50"><Plus size={15} />新增</button></div></div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {categories.length ? categories.map((category) => {
              const editing = editingCategoryId === category.id
              const acting = categoryActionId === category.id
              return <div key={category.id} className="flex min-w-0 items-center gap-2 rounded-xl border border-[#17211d]/10 bg-[#f8f6f0] px-3 py-2 dark:border-darkBorder dark:bg-darkBg">
                {editing ? <input value={editingCategoryName} onChange={(event) => setEditingCategoryName(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') updateCategory(category); if (event.key === 'Escape') setEditingCategoryId(null) }} autoFocus maxLength={100} className="min-w-0 flex-1 rounded-lg border border-[#17211d]/15 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-[#163a2b] dark:border-darkBorder dark:bg-darkCard" /> : <span className="min-w-0 flex-1 truncate text-sm font-semibold text-[#17211d]/75 dark:text-foreground/75">{category.name}</span>}
                {editing ? <>
                  <button disabled={acting} onClick={() => updateCategory(category)} className="rounded-lg bg-[#163a2b] px-2.5 py-1.5 text-xs font-bold text-white disabled:opacity-50">{acting ? <Loader2 size={13} className="animate-spin" /> : '保存'}</button>
                  <button disabled={acting} onClick={() => { setEditingCategoryId(null); setEditingCategoryName('') }} className="rounded-lg border border-[#17211d]/15 px-2.5 py-1.5 text-xs font-semibold text-[#17211d]/60 dark:border-darkBorder dark:text-foreground/60">取消</button>
                </> : <>
                  <button disabled={categoryActionId !== null} onClick={() => startEditingCategory(category)} className="rounded-lg border border-[#17211d]/15 p-1.5 text-[#17211d]/55 transition hover:border-[#163a2b] hover:text-[#163a2b] disabled:opacity-40 dark:border-darkBorder dark:text-foreground/55" title="修改分区"><PenLine size={14} /></button>
                  <button disabled={categoryActionId !== null} onClick={() => removeCategory(category)} className="rounded-lg border border-red-200 p-1.5 text-red-500 transition hover:bg-red-500 hover:text-white disabled:opacity-40 dark:border-red-500/30" title="删除分区">{acting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}</button>
                </>}
              </div>
            }) : <span className="text-xs text-[#17211d]/45 dark:text-foreground/45">尚未创建技术分区。</span>}
          </div>
        </section>}

        {message && <p className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600 dark:border-red-500/30 dark:bg-red-500/10">{message}</p>}

        {loading ? (
          <div className="grid min-h-72 place-items-center"><Loader2 className="h-8 w-8 animate-spin text-[#b56b19]" /></div>
        ) : posts.length === 0 ? (
          <div className="mt-8 rounded-[2rem] border border-dashed border-[#17211d]/20 bg-white/50 px-6 py-20 text-center dark:border-darkBorder dark:bg-darkCard/30"><FilePenLine className="mx-auto h-9 w-9 text-[#b56b19]" /><h2 className="mt-4 font-display text-xl font-bold">还没有文章</h2><p className="mt-2 text-sm text-[#17211d]/55 dark:text-foreground/55">先新建一篇草稿，再决定是否对访客公开。</p></div>
        ) : (
          <div className="mt-8 overflow-hidden rounded-[1.5rem] border border-[#17211d]/10 bg-white dark:border-darkBorder dark:bg-darkCard">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 border-b border-[#17211d]/10 px-5 py-3 text-xs font-bold uppercase tracking-[0.12em] text-[#17211d]/45 dark:border-darkBorder dark:text-foreground/45 md:grid-cols-[minmax(0,1fr)_130px_120px_180px]">
              <span>文章</span><span className="hidden md:block">状态</span><span className="hidden md:block">更新</span><span>操作</span>
            </div>
            {posts.map((post) => {
              const published = post.is_public && post.is_published
              const acting = actingId === post.id
              return <div key={post.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 border-b border-[#17211d]/10 px-5 py-5 last:border-0 dark:border-darkBorder md:grid-cols-[minmax(0,1fr)_130px_120px_180px]">
                <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="truncate font-display text-lg font-bold">{post.title}</h2>{post.category && <span className="rounded-md bg-[#f1eee5] px-2 py-1 text-[10px] font-bold text-[#17211d]/60 dark:bg-darkBg dark:text-foreground/60">{post.category.name}</span>}</div><p className="mt-1 truncate text-sm text-[#17211d]/50 dark:text-foreground/50">{post.excerpt || '尚未填写摘要'}</p>{isRoot && <p className="mt-2 text-xs text-[#b56b19]">作者：{post.author?.display_name || post.author?.username || '未知'}</p>}</div>
                <div className="hidden items-center md:flex"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${published ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300' : 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300'}`}>{published ? '已公开' : '草稿'}</span></div>
                <div className="hidden items-center text-xs text-[#17211d]/50 dark:text-foreground/50 md:flex">{formatDate(post.updated_at)}</div>
                <div className="flex items-center justify-end gap-2"><Link href={`/blog/write?postId=${post.id}`} className="rounded-lg border border-[#17211d]/15 p-2 text-[#17211d]/70 transition hover:border-[#163a2b] hover:text-[#163a2b] dark:border-darkBorder dark:text-foreground/70" title="编辑文章"><PenLine size={15} /></Link>{post.author_id === user?.id ? <Link href={`/blog/preview/${post.id}`} className="rounded-lg border border-[#17211d]/15 p-2 text-[#17211d]/70 transition hover:border-[#163a2b] hover:text-[#163a2b] dark:border-darkBorder dark:text-foreground/70" title="私密预览"><LockKeyhole size={15} /></Link> : null}{published ? <Link href={`/blog/${post.slug}`} className="rounded-lg border border-[#17211d]/15 p-2 text-[#17211d]/70 transition hover:border-[#163a2b] hover:text-[#163a2b] dark:border-darkBorder dark:text-foreground/70" title="查看公开文章"><Eye size={15} /></Link> : null}{isRoot && published ? <button disabled={acting} onClick={() => changeFeatured(post)} className={`rounded-lg border p-2 transition disabled:opacity-50 ${post.is_featured ? 'border-[#f7b84b] bg-[#f7b84b]/15 text-[#b56b19]' : 'border-[#17211d]/15 text-[#17211d]/60 hover:border-[#f7b84b] hover:text-[#b56b19] dark:border-darkBorder dark:text-foreground/60'}`} title={post.is_featured ? '取消首页精选' : '设为首页精选'}><Star size={15} fill={post.is_featured ? 'currentColor' : 'none'} /></button> : null}<button disabled={acting} onClick={() => changePublication(post)} className="rounded-lg border border-[#17211d]/15 p-2 text-[#17211d]/70 transition hover:border-[#163a2b] hover:text-[#163a2b] disabled:opacity-50 dark:border-darkBorder dark:text-foreground/70" title={published ? '撤回公开' : '公开发布'}>{acting ? <Loader2 size={15} className="animate-spin" /> : published ? <Globe2 size={15} /> : <Send size={15} />}</button><button disabled={acting} onClick={() => removePost(post)} className="rounded-lg border border-red-200 p-2 text-red-500 transition hover:bg-red-500 hover:text-white disabled:opacity-50 dark:border-red-500/30" title="删除文章"><Trash2 size={15} /></button></div>
              </div>
            })}
          </div>
        )}
      </main>
    </div>
  )
}
