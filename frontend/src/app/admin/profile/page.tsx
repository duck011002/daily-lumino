'use client'

import { ChangeEvent, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  ExternalLink,
  Film,
  Github,
  ImagePlus,
  Link2,
  Loader2,
  Mail,
  Music2,
  Plus,
  Save,
  Search,
  Star,
  Sparkles,
  Trash2,
  UserRound,
} from 'lucide-react'
import api, { getErrorMessage } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import SiteNav from '@/components/layout/SiteNav'
import BackLink from '@/components/ui/BackLink'
import LibraryMcpPanel from '@/components/admin/LibraryMcpPanel'
import AIQuickAction from '@/components/ai/AIQuickAction'
import {
  defaultSiteProfile,
  MediaCategory,
  SiteMediaCard,
  SiteProfile,
  SiteProfileLink,
} from '@/lib/siteProfile'

const inputClass =
  'w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-800 outline-none transition placeholder:text-stone-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100 dark:focus:border-emerald-500 dark:focus:ring-emerald-950'

const mediaLabels: Record<MediaCategory, string> = {
  book: '书籍',
  movie: '影视',
  music: '音乐',
  status: '生活状态',
  other: '其他收藏',
}

const mediaIcons: Record<MediaCategory, typeof BookOpen> = {
  book: BookOpen,
  movie: Film,
  music: Music2,
  status: Sparkles,
  other: Link2,
}

const createId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`

const LOCAL_DRAFT_KEY = 'lumino-library-profile-draft-v1'
type MediaFilter = 'all' | MediaCategory | 'featured' | 'hidden'

export default function ProfileAdminPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [profile, setProfile] = useState<SiteProfile>(defaultSiteProfile)
  const [tagsText, setTagsText] = useState(defaultSiteProfile.interest_tags.join('、'))
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  )
  const [savedSnapshot, setSavedSnapshot] = useState('')
  const [mediaFilter, setMediaFilter] = useState<MediaFilter>('all')
  const [mediaSearch, setMediaSearch] = useState('')
  const currentSnapshot = useMemo(() => JSON.stringify({ profile, tagsText }), [profile, tagsText])
  const isDirty = Boolean(savedSnapshot && savedSnapshot !== currentSnapshot)

  useEffect(() => {
    if (authLoading) return
    if (!user?.is_root) {
      router.replace('/dashboard')
      return
    }

    const loadProfile = async () => {
      try {
        const response = await api.get<SiteProfile>('/admin/site-profile')
        const serverTags = response.data.interest_tags.join('、')
        setProfile(response.data)
        setTagsText(serverTags)
        setSavedSnapshot(JSON.stringify({ profile: response.data, tagsText: serverTags }))
        const stored = window.localStorage.getItem(LOCAL_DRAFT_KEY)
        if (stored && window.confirm('发现上次未保存的书房草稿，是否恢复？')) {
          try {
            const draft = JSON.parse(stored) as { profile: SiteProfile; tagsText: string }
            setProfile(draft.profile)
            setTagsText(draft.tagsText)
            setMessage({ type: 'success', text: '已恢复本地草稿，确认后请保存。' })
          } catch { window.localStorage.removeItem(LOCAL_DRAFT_KEY) }
        } else if (stored) window.localStorage.removeItem(LOCAL_DRAFT_KEY)
      } catch (error) {
        setMessage({ type: 'error', text: getErrorMessage(error, '读取书房资料失败。') })
      } finally {
        setLoading(false)
      }
    }

    void loadProfile()
  }, [authLoading, router, user])

  useEffect(() => {
    if (!isDirty) return
    const timer = window.setTimeout(() => window.localStorage.setItem(LOCAL_DRAFT_KEY, currentSnapshot), 500)
    return () => window.clearTimeout(timer)
  }, [currentSnapshot, isDirty])

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (!isDirty) return
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [isDirty])

  const publicMedia = useMemo(
    () =>
      [...profile.media_cards]
        .filter((item) => item.is_public)
        .sort((a, b) => a.sort_order - b.sort_order),
    [profile.media_cards]
  )
  const filteredMedia = useMemo(() => {
    const keyword = mediaSearch.trim().toLocaleLowerCase()
    return profile.media_cards.filter((item) => {
      const matchesFilter = mediaFilter === 'all'
        || (mediaFilter === 'featured' && item.is_featured)
        || (mediaFilter === 'hidden' && !item.is_public)
        || item.category === mediaFilter
      const matchesSearch = !keyword || [item.title, item.creator, item.year, item.badge]
        .filter(Boolean)
        .some((value) => value!.toLocaleLowerCase().includes(keyword))
      return matchesFilter && matchesSearch
    })
  }, [mediaFilter, mediaSearch, profile.media_cards])
  const homePreviewMedia = useMemo(() => {
    const featured = publicMedia.filter((item) => item.is_featured)
    if (featured.length > 0) return featured
    return (['book', 'movie', 'music'] as MediaCategory[])
      .map((category) => publicMedia.find((item) => item.category === category))
      .filter((item): item is SiteMediaCard => Boolean(item))
  }, [publicMedia])

  const updateProfile = <K extends keyof SiteProfile>(key: K, value: SiteProfile[K]) => {
    setProfile((current) => ({ ...current, [key]: value }))
  }

  const updateLink = (id: string, patch: Partial<SiteProfileLink>) => {
    updateProfile(
      'links',
      profile.links.map((item) => (item.id === id ? { ...item, ...patch } : item))
    )
  }

  const updateMedia = (id: string, patch: Partial<SiteMediaCard>) => {
    updateProfile(
      'media_cards',
      profile.media_cards.map((item) => (item.id === id ? { ...item, ...patch } : item))
    )
  }

  const updateFeatured = (id: string, checked: boolean) => {
    updateMedia(id, { is_featured: checked })
  }

  const moveItem = (collection: 'links' | 'media_cards', index: number, direction: -1 | 1) => {
    const target = index + direction
    if (collection === 'links') {
      const items = [...profile.links]
      if (target < 0 || target >= items.length) return
      ;[items[index], items[target]] = [items[target], items[index]]
      updateProfile(
        'links',
        items.map((item, itemIndex) => ({ ...item, sort_order: itemIndex }))
      )
      return
    }

    const items = [...profile.media_cards]
    if (target < 0 || target >= items.length) return
    ;[items[index], items[target]] = [items[target], items[index]]
    updateProfile(
      'media_cards',
      items.map((item, itemIndex) => ({ ...item, sort_order: itemIndex }))
    )
  }

  const uploadImage = async (
    event: ChangeEvent<HTMLInputElement>,
    target: string,
    onUploaded: (url: string) => void
  ) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    const formData = new FormData()
    formData.append('file', file)
    setUploading(target)
    setMessage(null)
    try {
      const response = await api.post<{ url: string }>('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      onUploaded(response.data.url)
    } catch (error) {
      setMessage({ type: 'error', text: getErrorMessage(error, '图片上传失败。') })
    } finally {
      setUploading(null)
    }
  }

  const addLink = () => {
    updateProfile('links', [
      ...profile.links,
      {
        id: createId(),
        label: '',
        url: '',
        is_public: true,
        sort_order: profile.links.length,
      },
    ])
  }

  const addMedia = () => {
    updateProfile('media_cards', [
      ...profile.media_cards,
      {
        id: createId(),
        category: 'book',
        title: '',
        subtitle: null,
        creator: null,
        year: null,
        badge: null,
        note: null,
        image_url: null,
        url: null,
        is_public: true,
        is_featured: false,
        sort_order: profile.media_cards.length,
      },
    ])
  }

  const saveProfile = async () => {
    setSaving(true)
    setMessage(null)
    try {
      const payload: SiteProfile = {
        ...profile,
        interest_tags: tagsText
          .split(/[、,，\n]/)
          .map((item) => item.trim())
          .filter(Boolean),
        links: profile.links
          .filter((item) => item.label.trim() && item.url.trim())
          .map((item, index) => ({ ...item, sort_order: index })),
        media_cards: profile.media_cards
          .filter((item) => item.title.trim())
          .map((item, index) => ({
            ...item,
            sort_order: index,
          })),
      }
      const response = await api.put<SiteProfile>('/admin/site-profile', payload)
      setProfile(response.data)
      const savedTags = response.data.interest_tags.join('、')
      setTagsText(savedTags)
      setSavedSnapshot(JSON.stringify({ profile: response.data, tagsText: savedTags }))
      window.localStorage.removeItem(LOCAL_DRAFT_KEY)
      setMessage({ type: 'success', text: '书房资料已保存，前厅与书房会立即使用新内容。' })
    } catch (error) {
      setMessage({ type: 'error', text: getErrorMessage(error, '保存书房资料失败。') })
    } finally {
      setSaving(false)
    }
  }

  const refreshProfile = async () => {
    const response = await api.get<SiteProfile>('/admin/site-profile')
    const serverTags = response.data.interest_tags.join('、')
    setProfile(response.data)
    setTagsText(serverTags)
    setSavedSnapshot(JSON.stringify({ profile: response.data, tagsText: serverTags }))
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-stone-50 dark:bg-stone-950">
        <SiteNav />
        <div className="flex min-h-[70vh] items-center justify-center text-stone-500">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          正在整理书房资料…
        </div>
      </div>
    )
  }

  if (!user?.is_root) return null

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 dark:bg-stone-950 dark:text-stone-100">
      <SiteNav />

      <main className="mx-auto max-w-7xl px-4 pb-28 pt-8 sm:px-6 lg:px-8 lg:pb-28 lg:pt-12">
        <div className="mb-8">
          <AIQuickAction
            context="library"
            placeholder="告诉 AI：在 Library 新增一本《……》，作者是……"
            onCompleted={refreshProfile}
          />
        </div>
        <div className="mb-8 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-4">
              <BackLink href="/admin" label="返回管理后台" />
            </div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.24em] text-emerald-700 dark:text-emerald-400">
              Personal study
            </p>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              书房与个人资料
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-stone-600 dark:text-stone-400">
              管理前厅使用的个人名片，以及书房中的完整介绍、联系方式和收藏。关闭公开开关的内容只保留在后台。
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/library"
              target="_blank"
              className="inline-flex items-center gap-2 rounded-full border border-stone-300 bg-white px-5 py-2.5 text-sm font-medium transition hover:border-emerald-500 hover:text-emerald-700 dark:border-stone-700 dark:bg-stone-900 dark:hover:text-emerald-400"
            >
              预览书房
              <ExternalLink className="h-4 w-4" />
            </Link>
            <Link
              href="/"
              target="_blank"
              className="inline-flex items-center gap-2 rounded-full border border-stone-300 bg-white px-5 py-2.5 text-sm font-medium transition hover:border-emerald-500 hover:text-emerald-700 dark:border-stone-700 dark:bg-stone-900 dark:hover:text-emerald-400"
            >
              预览前厅
              <ExternalLink className="h-4 w-4" />
            </Link>
          </div>
        </div>

        {message && (
          <div
            className={`mb-6 rounded-2xl border px-4 py-3 text-sm ${
              message.type === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300'
                : 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300'
            }`}
          >
            {message.text}
          </div>
        )}

        <nav className="sticky top-32 z-30 mb-7 flex gap-2 overflow-x-auto rounded-2xl border border-stone-200/80 bg-white/90 p-2 shadow-sm backdrop-blur dark:border-stone-800 dark:bg-stone-900/90 sm:top-20">
          {[['profile-card', '个人名片'], ['contact-links', '联系方式'], ['media-shelf', '收藏架'], ['library-mcp', 'AI 助手']].map(([id, label]) => (
            <a key={id} href={`#${id}`} className="shrink-0 rounded-xl px-3 py-2 text-xs font-semibold text-stone-600 transition hover:bg-emerald-50 hover:text-emerald-700 dark:text-stone-300 dark:hover:bg-emerald-950">{label}</a>
          ))}
        </nav>

        <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-7">
            <section id="profile-card" className="relative scroll-mt-40 overflow-hidden rounded-[2rem] border border-emerald-200 bg-gradient-to-br from-white via-white to-emerald-50/70 p-5 shadow-[0_22px_60px_-45px_rgba(5,150,105,0.55)] dark:border-emerald-950 dark:from-stone-900 dark:via-stone-900 dark:to-emerald-950/30 sm:p-7">
              <div className="-mx-5 -mt-5 mb-7 flex items-center justify-between gap-4 border-b border-emerald-100 bg-emerald-50/70 px-5 py-5 dark:border-emerald-950 dark:bg-emerald-950/30 sm:-mx-7 sm:-mt-7 sm:px-7 sm:py-6">
                <div className="flex items-center gap-3">
                  <span className="rounded-2xl bg-emerald-700 p-2.5 text-white shadow-lg shadow-emerald-700/20 dark:bg-emerald-600">
                    <UserRound className="h-5 w-5" />
                  </span>
                  <div>
                    <h2 className="text-lg font-semibold">个人名片</h2>
                    <p className="text-sm text-stone-500">
                      姓名、简介与前厅 / 书房视觉素材
                    </p>
                  </div>
                </div>
                <span className="hidden rounded-full border border-emerald-200 bg-white/80 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:border-emerald-900 dark:bg-stone-900 dark:text-emerald-300 sm:inline-flex">公开身份</span>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-medium">显示名称</span>
                  <input
                    className={inputClass}
                    value={profile.display_name}
                    onChange={(event) => updateProfile('display_name', event.target.value)}
                    placeholder="例如：Lumino"
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium">一句话介绍</span>
                  <input
                    className={inputClass}
                    value={profile.headline}
                    onChange={(event) => updateProfile('headline', event.target.value)}
                    placeholder="开发者，也在认真收藏生活"
                  />
                </label>
                <label className="space-y-2 sm:col-span-2">
                  <span className="text-sm font-medium">完整简介</span>
                  <textarea
                    className={`${inputClass} min-h-32 resize-y leading-7`}
                    value={profile.bio}
                    onChange={(event) => updateProfile('bio', event.target.value)}
                    placeholder="介绍你是谁，以及这座数字庭院记录什么。"
                  />
                </label>
                <label className="space-y-2 sm:col-span-2">
                  <span className="text-sm font-medium">兴趣标签</span>
                  <input
                    className={inputClass}
                    value={tagsText}
                    onChange={(event) => setTagsText(event.target.value)}
                    placeholder="开发者、INFJ、摄影、阅读"
                  />
                  <span className="block text-xs text-stone-400">使用顿号或逗号分隔</span>
                </label>

                <ImageField
                  label="头像"
                  value={profile.avatar_url}
                  uploading={uploading === 'avatar'}
                  onChange={(value) => updateProfile('avatar_url', value || null)}
                  onUpload={(event) =>
                    uploadImage(event, 'avatar', (url) => updateProfile('avatar_url', url))
                  }
                />
                <ImageField
                  label="前厅 / 书房背景图（可选）"
                  value={profile.cover_url}
                  uploading={uploading === 'cover'}
                  onChange={(value) => updateProfile('cover_url', value || null)}
                  onUpload={(event) =>
                    uploadImage(event, 'cover', (url) => updateProfile('cover_url', url))
                  }
                />
              </div>
            </section>

            <section id="contact-links" className="scroll-mt-40 rounded-[2rem] border border-stone-200 bg-white p-5 shadow-sm dark:border-stone-800 dark:bg-stone-900 sm:p-7">
              <div className="mb-6 flex items-center gap-3">
                <span className="rounded-2xl bg-amber-100 p-2.5 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                  <Link2 className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="text-lg font-semibold">公开联系与状态</h2>
                  <p className="text-sm text-stone-500">GitHub、邮箱和其他外部入口</p>
                </div>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <label className="space-y-2">
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <Github className="h-4 w-4" />
                    GitHub 链接
                  </span>
                  <input
                    className={inputClass}
                    value={profile.github_url || ''}
                    onChange={(event) => updateProfile('github_url', event.target.value || null)}
                    placeholder="https://github.com/..."
                  />
                </label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <Mail className="h-4 w-4" />
                    公开邮箱
                  </label>
                  <input
                    className={inputClass}
                    type="email"
                    value={profile.email || ''}
                    onChange={(event) => updateProfile('email', event.target.value || null)}
                    placeholder="hello@example.com"
                  />
                  <Toggle
                    checked={profile.show_email}
                    onChange={(checked) => updateProfile('show_email', checked)}
                    label="公开展示邮箱"
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <label className="text-sm font-medium">此刻状态（可选）</label>
                  <input
                    className={inputClass}
                    value={profile.status_text || ''}
                    onChange={(event) => updateProfile('status_text', event.target.value || null)}
                    placeholder="例如：正在把 Lumino 变成一座数字庭院"
                  />
                  <Toggle
                    checked={profile.status_public}
                    onChange={(checked) => updateProfile('status_public', checked)}
                    label="公开展示此刻状态"
                  />
                </div>
              </div>

              <div className="mt-7 border-t border-stone-100 pt-6 dark:border-stone-800">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">其他链接</h3>
                    <p className="mt-1 text-xs text-stone-500">可添加个人主页、社交账号或其他公开入口</p>
                  </div>
                  <button
                    type="button"
                    onClick={addLink}
                    className="inline-flex items-center gap-1.5 rounded-full border border-stone-300 px-3 py-2 text-xs font-medium transition hover:border-emerald-500 hover:text-emerald-700 dark:border-stone-700 dark:hover:text-emerald-400"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    添加链接
                  </button>
                </div>
                <div className="space-y-3">
                  {profile.links.length === 0 && (
                    <p className="rounded-2xl bg-stone-50 px-4 py-5 text-center text-sm text-stone-400 dark:bg-stone-950">
                      还没有其他链接
                    </p>
                  )}
                  {profile.links.map((item, index) => (
                    <div
                      key={item.id}
                      className="grid gap-3 rounded-2xl border border-stone-200 p-4 dark:border-stone-800 sm:grid-cols-[140px_minmax(0,1fr)_auto]"
                    >
                      <input
                        className={inputClass}
                        value={item.label}
                        onChange={(event) => updateLink(item.id, { label: event.target.value })}
                        placeholder="名称"
                      />
                      <input
                        className={inputClass}
                        value={item.url}
                        onChange={(event) => updateLink(item.id, { url: event.target.value })}
                        placeholder="https://..."
                      />
                      <ItemActions
                        isPublic={item.is_public}
                        onPublicChange={(checked) => updateLink(item.id, { is_public: checked })}
                        onUp={() => moveItem('links', index, -1)}
                        onDown={() => moveItem('links', index, 1)}
                        onDelete={() =>
                          updateProfile(
                            'links',
                            profile.links.filter((link) => link.id !== item.id)
                          )
                        }
                        disableUp={index === 0}
                        disableDown={index === profile.links.length - 1}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section id="media-shelf" className="scroll-mt-40 rounded-[2rem] border border-stone-200 bg-white p-5 shadow-sm dark:border-stone-800 dark:bg-stone-900 sm:p-7">
              <div className="mb-6 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="rounded-2xl bg-violet-100 p-2.5 text-violet-700 dark:bg-violet-950 dark:text-violet-300">
                    <BookOpen className="h-5 w-5" />
                  </span>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-semibold">我的收藏架</h2>
                      <span className="rounded-full bg-violet-100 px-2.5 py-1 text-[11px] font-semibold text-violet-700 dark:bg-violet-950 dark:text-violet-300">{profile.media_cards.length}/24</span>
                    </div>
                    <p className="text-sm text-stone-500">
                      分享喜欢的影视、书籍与音乐，不需要创建站内详情页
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={addMedia}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-stone-300 px-3 py-2 text-xs font-medium transition hover:border-emerald-500 hover:text-emerald-700 dark:border-stone-700 dark:hover:text-emerald-400"
                >
                  <Plus className="h-3.5 w-3.5" />
                  添加卡片
                </button>
              </div>
              <p className="mb-5 rounded-2xl bg-violet-50 px-4 py-3 text-xs leading-6 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300">
                书房展示全部公开卡片；标记为“前厅精选”的卡片会按当前顺序进入前厅的横向收藏架，数量不受限制。
              </p>

              <div className="mb-5 space-y-3">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                  <input value={mediaSearch} onChange={(event) => setMediaSearch(event.target.value)} placeholder="搜索标题、创作者、年份或标签" className="w-full rounded-2xl border border-stone-200 bg-stone-50 py-3 pl-10 pr-4 text-sm outline-none transition focus:border-violet-400 focus:bg-white dark:border-stone-800 dark:bg-stone-950" />
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {([
                    ['all', '全部'], ['featured', '前厅精选'], ['book', '书籍'], ['movie', '影视'], ['music', '音乐'], ['status', '生活状态'], ['other', '其他'], ['hidden', '已隐藏'],
                  ] as Array<[MediaFilter, string]>).map(([value, label]) => (
                    <button key={value} type="button" onClick={() => setMediaFilter(value)} className={`shrink-0 rounded-full px-3 py-2 text-xs font-semibold transition ${mediaFilter === value ? 'bg-violet-700 text-white shadow-sm' : 'bg-stone-100 text-stone-600 hover:bg-violet-100 hover:text-violet-700 dark:bg-stone-800 dark:text-stone-300'}`}>{label}</button>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                {filteredMedia.length === 0 && (
                  <p className="rounded-2xl bg-stone-50 px-4 py-8 text-center text-sm text-stone-400 dark:bg-stone-950 md:col-span-2">
                    {profile.media_cards.length === 0 ? '收藏架还是空的，可以先添加一部喜欢的电影、一本书或一张专辑。' : '没有符合当前筛选条件的收藏。'}
                  </p>
                )}
                {filteredMedia.map((item) => (
                  <details
                    key={item.id}
                    className="group overflow-hidden rounded-3xl border border-stone-200 bg-stone-50/60 transition open:shadow-lg dark:border-stone-800 dark:bg-stone-950/50 md:open:col-span-2 2xl:open:col-span-3"
                  >
                    <summary className="flex cursor-pointer list-none items-center gap-3 p-4 marker:hidden">
                      <div className="h-16 w-12 shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-violet-100 to-amber-100 dark:from-violet-950 dark:to-stone-800">
                        {item.image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={item.image_url} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="grid h-full place-items-center text-violet-500"><Sparkles className="h-5 w-5" /></div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><p className="truncate font-semibold">{item.title || '未填写标题'}</p>{item.is_featured && <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-500" />}</div><p className="mt-1 truncate text-xs text-stone-500">{mediaLabels[item.category]}{item.creator ? ` · ${item.creator}` : ''}{item.year ? ` · ${item.year}` : ''}</p><div className="mt-2 flex gap-1.5"><span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${item.is_public ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-stone-200 text-stone-500 dark:bg-stone-800'}`}>{item.is_public ? '公开' : '隐藏'}</span>{item.is_featured && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-950 dark:text-amber-300">前厅精选</span>}</div></div>
                      <span className="text-xs font-semibold text-violet-600">编辑</span>
                    </summary>
                    <div className="border-t border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-900 sm:p-5">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="space-y-2">
                        <span className="text-xs font-medium text-stone-500">类型</span>
                        <select
                          className={inputClass}
                          value={item.category}
                          onChange={(event) =>
                            updateMedia(item.id, {
                              category: event.target.value as MediaCategory,
                            })
                          }
                        >
                          {Object.entries(mediaLabels).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="space-y-2">
                        <span className="text-xs font-medium text-stone-500">标题</span>
                        <input
                          className={inputClass}
                          value={item.title}
                          onChange={(event) => updateMedia(item.id, { title: event.target.value })}
                          placeholder="作品名称"
                        />
                      </label>
                      <label className="space-y-2">
                        <span className="text-xs font-medium text-stone-500">
                          作者 / 导演 / 歌手（可选）
                        </span>
                        <input
                          className={inputClass}
                          value={item.creator || item.subtitle || ''}
                          onChange={(event) =>
                            updateMedia(item.id, {
                              creator: event.target.value || null,
                              subtitle: null,
                            })
                          }
                          placeholder="例如：宫崎骏、村上春树、陈奕迅"
                        />
                      </label>
                      <label className="space-y-2">
                        <span className="text-xs font-medium text-stone-500">年份（可选）</span>
                        <input
                          className={inputClass}
                          value={item.year || ''}
                          onChange={(event) =>
                            updateMedia(item.id, { year: event.target.value || null })
                          }
                          placeholder="例如：2024"
                        />
                      </label>
                      <label className="space-y-2">
                        <span className="text-xs font-medium text-stone-500">
                          展示标签（可选）
                        </span>
                        <input
                          className={inputClass}
                          value={item.badge || ''}
                          onChange={(event) =>
                            updateMedia(item.id, { badge: event.target.value || null })
                          }
                          placeholder="例如：最喜欢、反复重读、循环播放"
                        />
                      </label>
                      <label className="space-y-2">
                        <span className="text-xs font-medium text-stone-500">
                          作品外部链接（可选）
                        </span>
                        <input
                          className={inputClass}
                          value={item.url || ''}
                          onChange={(event) =>
                            updateMedia(item.id, { url: event.target.value || null })
                          }
                          placeholder="豆瓣、IMDb、Spotify 或其他链接"
                        />
                      </label>
                      <label className="space-y-2 sm:col-span-2">
                        <span className="text-xs font-medium text-stone-500">
                          一句话推荐理由（可选）
                        </span>
                        <textarea
                          className={`${inputClass} min-h-24 resize-y`}
                          value={item.note || ''}
                          onChange={(event) =>
                            updateMedia(item.id, { note: event.target.value || null })
                          }
                          placeholder="为什么喜欢它，或者它在什么时候打动过你。"
                        />
                      </label>
                      <div className="sm:col-span-2">
                        <ImageField
                          label="封面图（可选）"
                          value={item.image_url}
                          uploading={uploading === `media-${item.id}`}
                          onChange={(value) =>
                            updateMedia(item.id, { image_url: value || null })
                          }
                          onUpload={(event) =>
                            uploadImage(event, `media-${item.id}`, (url) =>
                              updateMedia(item.id, { image_url: url })
                            )
                          }
                        />
                      </div>
                    </div>
                    <div className="mt-5 flex flex-col gap-3 border-t border-stone-100 pt-4 dark:border-stone-800 sm:flex-row sm:items-center sm:justify-between">
                      <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-semibold text-amber-700 dark:text-amber-300">
                        <input type="checkbox" checked={item.is_featured} onChange={(event) => updateFeatured(item.id, event.target.checked)} className="h-4 w-4 rounded border-stone-300 text-amber-500 focus:ring-amber-400" />
                        <Star className="h-4 w-4" />展示到前厅精选
                      </label>
                      <ItemActions
                        isPublic={item.is_public}
                        onPublicChange={(checked) =>
                          updateMedia(item.id, { is_public: checked, ...(!checked ? { is_featured: false } : {}) })
                        }
                        onUp={() => moveItem('media_cards', profile.media_cards.findIndex((media) => media.id === item.id), -1)}
                        onDown={() => moveItem('media_cards', profile.media_cards.findIndex((media) => media.id === item.id), 1)}
                        onDelete={() =>
                          updateProfile(
                            'media_cards',
                            profile.media_cards.filter((media) => media.id !== item.id)
                          )
                        }
                        disableUp={profile.media_cards.findIndex((media) => media.id === item.id) === 0}
                        disableDown={profile.media_cards.findIndex((media) => media.id === item.id) === profile.media_cards.length - 1}
                      />
                    </div>
                  </div>
                  </details>
                ))}
              </div>
            </section>
            <LibraryMcpPanel />
          </div>

          <aside className="xl:sticky xl:top-24 xl:max-h-[calc(100vh-7rem)] xl:self-start xl:overflow-y-auto xl:pr-2">
            <div className="overflow-hidden rounded-[2rem] border border-stone-200 bg-white shadow-sm dark:border-stone-800 dark:bg-stone-900">
              <div
                className="relative h-36 bg-gradient-to-br from-emerald-900 via-emerald-800 to-amber-700"
                style={
                  profile.cover_url
                    ? {
                        backgroundImage: `linear-gradient(120deg, rgba(6,78,59,.55), rgba(120,53,15,.35)), url("${profile.cover_url}")`,
                        backgroundPosition: 'center',
                        backgroundSize: 'cover',
                      }
                    : undefined
                }
              />
              <div className="px-6 pb-7">
                <div className="-mt-11 mb-4 flex h-22 w-22 items-center justify-center overflow-hidden rounded-3xl border-4 border-white bg-emerald-100 text-2xl font-semibold text-emerald-800 shadow-md dark:border-stone-900 dark:bg-emerald-950 dark:text-emerald-300">
                  {profile.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={profile.avatar_url}
                      alt={profile.display_name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    profile.display_name.slice(0, 1) || 'L'
                  )}
                </div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-400">
                  书房预览
                </p>
                <h2 className="mt-2 text-2xl font-semibold">{profile.display_name || '未命名'}</h2>
                <p className="mt-2 text-sm text-stone-600 dark:text-stone-300">
                  {profile.headline || '还没有一句话介绍'}
                </p>
                <p className="mt-4 line-clamp-4 text-sm leading-7 text-stone-500 dark:text-stone-400">
                  {profile.bio || '还没有填写个人简介。'}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {tagsText
                    .split(/[、,，\n]/)
                    .map((tag) => tag.trim())
                    .filter(Boolean)
                    .slice(0, 5)
                    .map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-stone-100 px-3 py-1 text-xs text-stone-600 dark:bg-stone-800 dark:text-stone-300"
                      >
                        {tag}
                      </span>
                    ))}
                </div>
                {(profile.github_url || (profile.email && profile.show_email)) && (
                  <div className="mt-5 flex gap-2 border-t border-stone-100 pt-5 dark:border-stone-800">
                    {profile.github_url && (
                      <span className="rounded-full border border-stone-200 p-2 dark:border-stone-700">
                        <Github className="h-4 w-4" />
                      </span>
                    )}
                    {profile.email && profile.show_email && (
                      <span className="rounded-full border border-stone-200 p-2 dark:border-stone-700">
                        <Mail className="h-4 w-4" />
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {homePreviewMedia.length > 0 && (
              <div className="mt-5 rounded-[2rem] border border-stone-200 bg-white p-5 shadow-sm dark:border-stone-800 dark:bg-stone-900">
                <div className="flex items-center justify-between"><h3 className="text-sm font-semibold">前厅精选预览</h3><span className="text-xs font-semibold text-amber-600">{homePreviewMedia.length} 张</span></div>
                <p className="mt-2 text-xs leading-5 text-stone-400">有精选标记时展示全部精选；未设置时按书籍、影视、音乐自动补位。</p>
                <div className="mt-4 max-h-80 space-y-3 overflow-y-auto pr-1">
                  {homePreviewMedia.map((item) => {
                    const Icon = mediaIcons[item.category]
                    return (
                      <div key={item.id} className="flex items-center gap-3">
                        <span className="rounded-xl bg-stone-100 p-2 dark:bg-stone-800">
                          <Icon className="h-4 w-4" />
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs text-stone-400">{mediaLabels[item.category]}</p>
                          <p className="truncate text-sm font-medium">{item.title || '未填写标题'}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </aside>
        </div>
      </main>

      <div className="fixed bottom-4 left-3 right-3 z-50 flex items-center justify-between gap-3 rounded-2xl border border-stone-200/90 bg-white/95 p-3 shadow-2xl backdrop-blur dark:border-stone-700 dark:bg-stone-900/95 sm:left-auto sm:right-6 sm:min-w-[280px]">
        <p
          aria-live="polite"
          className={`line-clamp-2 text-xs ${
            message?.type === 'error'
              ? 'text-red-600 dark:text-red-400'
              : message?.type === 'success'
                ? 'text-emerald-700 dark:text-emerald-400'
                : 'text-stone-500 dark:text-stone-400'
          }`}
        >
          {uploading !== null
            ? '图片上传完成后即可保存'
            : isDirty
              ? '有未保存修改，已自动暂存在本机'
              : message?.text || '所有修改均已保存'}
        </p>
        <button
          type="button"
          onClick={saveProfile}
          disabled={saving || uploading !== null || !isDirty}
          className="inline-flex shrink-0 items-center gap-2 rounded-full bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-emerald-600 dark:hover:bg-emerald-500"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? '保存中…' : isDirty ? '保存资料' : '已保存'}
        </button>
      </div>
    </div>
  )
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
}) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-stone-500">
      <input
        type="checkbox"
        className="h-4 w-4 rounded border-stone-300 text-emerald-700 focus:ring-emerald-500"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      {label}
    </label>
  )
}

function ImageField({
  label,
  value,
  uploading,
  onChange,
  onUpload,
}: {
  label: string
  value: string | null
  uploading: boolean
  onChange: (value: string) => void
  onUpload: (event: ChangeEvent<HTMLInputElement>) => void
}) {
  return (
    <div className="space-y-2">
      <span className="text-sm font-medium">{label}</span>
      <div className="flex gap-2">
        <input
          className={inputClass}
          value={value || ''}
          onChange={(event) => onChange(event.target.value)}
          placeholder="图片链接，或使用右侧按钮上传"
        />
        <label className="inline-flex shrink-0 cursor-pointer items-center justify-center rounded-2xl border border-stone-300 bg-stone-50 px-3 transition hover:border-emerald-500 hover:text-emerald-700 dark:border-stone-700 dark:bg-stone-800 dark:hover:text-emerald-400">
          {uploading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <ImagePlus className="h-5 w-5" />
          )}
          <span className="sr-only">上传图片</span>
          <input type="file" accept="image/*" className="sr-only" onChange={onUpload} />
        </label>
      </div>
    </div>
  )
}

function ItemActions({
  isPublic,
  onPublicChange,
  onUp,
  onDown,
  onDelete,
  disableUp,
  disableDown,
}: {
  isPublic: boolean
  onPublicChange: (checked: boolean) => void
  onUp: () => void
  onDown: () => void
  onDelete: () => void
  disableUp: boolean
  disableDown: boolean
}) {
  return (
    <div className="flex items-center justify-end gap-1">
      <label className="mr-2 inline-flex cursor-pointer items-center gap-1.5 text-xs text-stone-500">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-stone-300 text-emerald-700 focus:ring-emerald-500"
          checked={isPublic}
          onChange={(event) => onPublicChange(event.target.checked)}
        />
        公开
      </label>
      <ActionButton label="上移" onClick={onUp} disabled={disableUp}>
        <ArrowUp className="h-4 w-4" />
      </ActionButton>
      <ActionButton label="下移" onClick={onDown} disabled={disableDown}>
        <ArrowDown className="h-4 w-4" />
      </ActionButton>
      <ActionButton label="删除" onClick={onDelete} danger>
        <Trash2 className="h-4 w-4" />
      </ActionButton>
    </div>
  )
}

function ActionButton({
  label,
  onClick,
  disabled = false,
  danger = false,
  children,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  danger?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={`rounded-xl p-2 transition disabled:cursor-not-allowed disabled:opacity-30 ${
        danger
          ? 'text-stone-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950'
          : 'text-stone-400 hover:bg-stone-100 hover:text-stone-700 dark:hover:bg-stone-800 dark:hover:text-stone-200'
      }`}
    >
      {children}
    </button>
  )
}
