'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  ShieldAlert, Settings, Users, Key, Database, BookOpen, Plus, Loader2,
  Trash2, Edit, ArrowLeft, Save, Globe, Eye, CheckCircle, AlertCircle,
  Copy, Check, UserMinus, UserCheck, ShieldCheck, ToggleLeft, ToggleRight
} from 'lucide-react'
import dynamic from 'next/dynamic'
import { useAuth } from '@/hooks/useAuth'
import { useTheme } from '@/hooks/useTheme'
import api from '@/lib/api'
import Button from '@/components/ui/Button'
import ThemeToggle from '@/components/layout/ThemeToggle'

// Dynamic import of markdown editor to prevent hydration errors during SSR
const MDEditor = dynamic(
  () => import('@uiw/react-md-editor').then((mod) => mod.default),
  { ssr: false }
)

import '@uiw/react-md-editor/markdown-editor.css'
import '@uiw/react-markdown-preview/markdown.css'

interface UserResponse {
  id: number
  username: string
  email: string
  display_name: string | null
  avatar_url: string | null
  is_root: boolean
  is_active: boolean
  created_at: string
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

interface SystemConfig {
  id: number
  config_key: string
  config_val: string | null
  description: string | null
  updated_at: string
}

interface StorageQuota {
  id: number
  max_size_mb: number
  used_size_mb: number
  updated_at: string
}

interface InviteCode {
  id: number
  code: string
  created_by: number
  used_by: number | null
  expires_at: string | null
  used_at: string | null
  created_at: string
}

type TabType = 'blog' | 'users' | 'configs' | 'quota'

export default function AdminConsole() {
  const { user, loading: authLoading } = useAuth()
  const { isDark } = useTheme()

  const [activeTab, setActiveTab] = useState<TabType>('blog')
  
  // States for Blog Tab
  const [posts, setPosts] = useState<BlogPost[]>([])
  const [loadingPosts, setLoadingPosts] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [editingPostId, setEditingPostId] = useState<number | null>(null)
  
  // Blog Form Fields
  const [formTitle, setFormTitle] = useState('')
  const [formSlug, setFormSlug] = useState('')
  const [formContent, setFormContent] = useState<string | undefined>('')
  const [formCoverUrl, setFormCoverUrl] = useState('')
  const [formExcerpt, setFormExcerpt] = useState('')
  const [formTags, setFormTags] = useState('')
  const [formIsPublic, setFormIsPublic] = useState(true)
  const [formIsPublished, setFormIsPublished] = useState(true)

  // States for Users Tab
  const [users, setUsers] = useState<UserResponse[]>([])
  const [loadingUsers, setLoadingUsers] = useState(true)

  // States for Configs Tab
  const [configs, setConfigs] = useState<SystemConfig[]>([])
  const [configValues, setConfigValues] = useState<Record<string, string>>({})
  const [loadingConfigs, setLoadingConfigs] = useState(true)
  const [visibleKeys, setVisibleKeys] = useState<Record<string, boolean>>({})

  // States for Quota/Invite Tab
  const [quota, setQuota] = useState<StorageQuota | null>(null)
  const [quotaInput, setQuotaInput] = useState<string>('')
  const [loadingQuota, setLoadingQuota] = useState(true)
  const [inviteCodes, setInviteCodes] = useState<InviteCode[]>([])
  const [loadingInvites, setLoadingInvites] = useState(true)
  const [inviteExpireHours, setInviteExpireHours] = useState<number>(24)
  const [creatingInvite, setCreatingInvite] = useState(false)
  
  const [copiedCode, setCopiedCode] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message })
    setTimeout(() => setToast(null), 3000)
  }

  // Fetch functions
  const fetchPosts = async () => {
    setLoadingPosts(true)
    try {
      const res = await api.get('/admin/blog/posts')
      setPosts(res.data)
    } catch (err: any) {
      console.error('获取文章列表失败', err)
    } finally {
      setLoadingPosts(false)
    }
  }

  const fetchUsers = async () => {
    setLoadingUsers(true)
    try {
      const res = await api.get('/admin/users')
      setUsers(res.data)
    } catch (err) {
      console.error('获取用户列表失败', err)
    } finally {
      setLoadingUsers(false)
    }
  }

  const fetchConfigs = async () => {
    setLoadingConfigs(true)
    try {
      const res = await api.get('/admin/configs')
      setConfigs(res.data)
      const vals: Record<string, string> = {}
      res.data.forEach((c: SystemConfig) => {
        vals[c.config_key] = c.config_val || ''
      })
      setConfigValues(vals)
    } catch (err) {
      console.error('获取配置列表失败', err)
    } finally {
      setLoadingConfigs(false)
    }
  }

  const fetchQuotaAndInvites = async () => {
    setLoadingQuota(true)
    setLoadingInvites(true)
    try {
      const quotaRes = await api.get('/admin/storage-quota')
      setQuota(quotaRes.data)
      setQuotaInput(quotaRes.data.max_size_mb.toString())
    } catch (err) {
      console.error('获取配额失败', err)
    } finally {
      setLoadingQuota(false)
    }

    try {
      const invitesRes = await api.get('/admin/invite-codes')
      setInviteCodes(invitesRes.data)
    } catch (err) {
      console.error('获取邀请码失败', err)
    } finally {
      setLoadingInvites(false)
    }
  }

  // Dynamic tab switcher hook
  useEffect(() => {
    if (user?.is_root) {
      if (activeTab === 'blog') {
        fetchPosts()
      } else if (activeTab === 'users') {
        fetchUsers()
      } else if (activeTab === 'configs') {
        fetchConfigs()
      } else if (activeTab === 'quota') {
        fetchQuotaAndInvites()
      }
    }
  }, [user, activeTab])

  // Setup keyboard shortcut for saving (Ctrl+S / Cmd+S)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isEditing && (e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        handleSavePost()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isEditing, formTitle, formSlug, formContent, formCoverUrl, formExcerpt, formTags, formIsPublic, formIsPublished])

  // User tab actions
  const handleToggleUserStatus = async (targetUser: UserResponse) => {
    if (targetUser.id === user?.id) {
      alert('不能禁用超级管理员自身账号。')
      return
    }
    try {
      const newStatus = !targetUser.is_active
      await api.patch(`/admin/users/${targetUser.id}`, { is_active: newStatus })
      showToast('success', `用户 ${targetUser.username} 已${newStatus ? '启用' : '禁用'}`)
      setUsers((prev) =>
        prev.map((u) => (u.id === targetUser.id ? { ...u, is_active: newStatus } : u))
      )
    } catch (err: any) {
      showToast('error', err.response?.data?.detail || '状态更新失败。')
    }
  }

  // Config tab actions
  const handleSaveConfig = async (key: string) => {
    const val = configValues[key] || ''
    const originalVal = configs.find(c => c.config_key === key)?.config_val || ''

    if (val === originalVal) {
      showToast('success', '未检测到配置变动。')
      return
    }

    if (val.includes('****')) {
      showToast('error', '请输入有效的配置值，包含脱敏星号的数值无法保存。')
      return
    }

    try {
      const res = await api.patch(`/admin/configs/${key}`, { config_val: val })
      showToast('success', `配置项 [${key}] 更新成功！`)
      setConfigValues(prev => ({ ...prev, [key]: res.data.config_val || '' }))
      // Update original value in config list
      setConfigs(prev => prev.map(c => c.config_key === key ? { ...c, config_val: res.data.config_val } : c))
    } catch (err: any) {
      showToast('error', err.response?.data?.detail || '配置保存失败。')
    }
  }

  // Quota tab actions
  const handleUpdateQuota = async () => {
    const size = parseFloat(quotaInput)
    if (isNaN(size) || size <= 0) {
      alert('请输入有效的存储配额大小！')
      return
    }
    try {
      const res = await api.patch('/admin/storage-quota', { max_size_mb: size })
      setQuota(res.data)
      showToast('success', '存储配额更新成功！')
    } catch (err: any) {
      showToast('error', err.response?.data?.detail || '更新存储配额失败。')
    }
  }

  const handleCreateInviteCode = async () => {
    setCreatingInvite(true)
    try {
      const res = await api.post('/admin/invite-codes', {
        expires_in_hours: inviteExpireHours > 0 ? inviteExpireHours : null
      })
      setInviteCodes(prev => [res.data, ...prev])
      showToast('success', '注册邀请码创建成功！')
    } catch (err: any) {
      showToast('error', err.response?.data?.detail || '创建邀请码失败。')
    } finally {
      setCreatingInvite(false)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedCode(text)
    setTimeout(() => setCopiedCode(null), 2000)
  }

  // Blog Tab Actions
  const handleOpenCreate = () => {
    setEditingPostId(null)
    setFormTitle('')
    setFormSlug('')
    setFormContent('# 新文章\n\n开始书写你的故事吧...')
    setFormCoverUrl('')
    setFormExcerpt('')
    setFormTags('')
    setFormIsPublic(true)
    setFormIsPublished(false)
    setIsEditing(true)
  }

  const handleOpenEdit = (post: BlogPost) => {
    setEditingPostId(post.id)
    setFormTitle(post.title)
    setFormSlug(post.slug)
    setFormContent(post.content)
    setFormCoverUrl(post.cover_url || '')
    setFormExcerpt(post.excerpt || '')
    setFormTags(post.tags ? post.tags.join(', ') : '')
    setFormIsPublic(post.is_public)
    setFormIsPublished(post.is_published)
    setIsEditing(true)
  }

  const handleSavePost = async () => {
    if (!formTitle.trim() || !formSlug.trim() || !formContent?.trim()) {
      alert('标题、链接标识 (Slug) 和内容不能为空！')
      return
    }

    setActionLoading(true)
    const tagsArray = formTags
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0)

    const payload = {
      title: formTitle.trim(),
      slug: formSlug.trim(),
      content: formContent,
      cover_url: formCoverUrl.trim() || null,
      excerpt: formExcerpt.trim() || null,
      tags: tagsArray.length > 0 ? tagsArray : null,
      is_public: formIsPublic,
      is_published: formIsPublished,
    }

    try {
      if (editingPostId === null) {
        await api.post('/admin/blog/posts', payload)
        showToast('success', '随笔文章发布成功！')
      } else {
        await api.patch(`/admin/blog/posts/${editingPostId}`, payload)
        showToast('success', '随笔文章更新成功！')
      }
      setIsEditing(false)
      fetchPosts()
    } catch (err: any) {
      showToast('error', err.response?.data?.detail || '保存文章失败。')
    } finally {
      setActionLoading(false)
    }
  }

  const handleDeletePost = async (postId: number) => {
    if (!confirm('确定要删除这篇随笔文章吗？此操作不可撤销。')) return
    try {
      await api.delete(`/admin/blog/posts/${postId}`)
      showToast('success', '随笔文章已成功删除。')
      fetchPosts()
    } catch (err: any) {
      showToast('error', err.response?.data?.detail || '删除失败。')
    }
  }

  // Guard routing loading
  if (authLoading) {
    return (
      <div className="min-h-screen bg-surface dark:bg-darkBg flex items-center justify-center">
        <Loader2 className="animate-spin text-primary h-8 w-8" />
      </div>
    )
  }

  // Root role checks
  if (user && !user.is_root) {
    return (
      <div className="flex-1 min-h-screen bg-surface dark:bg-darkBg flex flex-col justify-center items-center px-4 transition-colors duration-300">
        <div className="text-center space-y-6 max-w-md">
          <ShieldAlert className="h-16 w-16 text-red-500 mx-auto animate-bounce" />
          <h2 className="text-3xl font-bold text-red-500">权限不足</h2>
          <p className="text-sm text-onSurface/70 dark:text-foreground/70">
            抱歉，您没有访问系统超级管理后台的权限。该页面仅对超级管理员（Root）开放。
          </p>
          <Link href="/dashboard" passHref>
            <Button>返回工作台</Button>
          </Link>
        </div>
      </div>
    )
  }

  // Calculate statistics for Blog
  const totalPosts = posts.length
  const totalViews = posts.reduce((sum, p) => sum + p.view_count, 0)
  const publishedPosts = posts.filter((p) => p.is_published).length

  return (
    <div className="min-h-screen bg-surface dark:bg-darkBg transition-colors duration-300 flex flex-col">
      {/* Header */}
      <header className="w-full border-b border-secondary dark:border-darkBorder bg-white/50 dark:bg-darkCard/50 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Link href="/dashboard" className="text-primary hover:text-primary/80 transition-colors flex items-center gap-1 text-sm font-medium">
              <ArrowLeft size={16} />
              <span>工作台</span>
            </Link>
            <span className="text-onSurface/20 dark:text-foreground/20">|</span>
            <span className="font-display font-bold text-lg text-primary tracking-wide flex items-center gap-1.5">
              <Settings size={18} /> Lumino 系统超管后台
            </span>
          </div>
          <div className="flex items-center space-x-4">
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-6 py-8 flex-1 w-full">
        {/* Toast Toast Alert Notification */}
        {toast && (
          <div
            className={`fixed top-20 right-6 p-4 rounded-xl border z-50 flex items-center space-x-2 text-sm shadow-lg animate-fade-in ${
              toast.type === 'success'
                ? 'bg-green-50 dark:bg-green-500/10 text-green-800 dark:text-green-300 border-green-200 dark:border-green-500/20'
                : 'bg-red-50 dark:bg-red-500/10 text-red-800 dark:text-red-300 border-red-200 dark:border-red-500/20'
            }`}
          >
            {toast.type === 'success' ? <CheckCircle size={16} className="text-green-500" /> : <AlertCircle size={16} className="text-red-500" />}
            <span className="font-medium">{toast.message}</span>
          </div>
        )}

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Navigation Sidebar */}
          <div className="w-full lg:w-64 flex-shrink-0 flex flex-row lg:flex-col overflow-x-auto lg:overflow-x-visible pb-3 lg:pb-0 gap-2 lg:gap-1.5 border-b border-secondary/40 lg:border-b-0 dark:border-darkBorder/40 scrollbar-none">
            <button
              onClick={() => {
                setActiveTab('blog')
                setIsEditing(false)
              }}
              className={`flex-shrink-0 lg:w-full flex items-center space-x-2 lg:space-x-3 px-4 py-2.5 lg:py-3 rounded-xl transition-colors text-sm lg:text-base whitespace-nowrap ${
                activeTab === 'blog'
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-onSurface/70 dark:text-foreground/70 hover:bg-secondary/50 dark:hover:bg-darkBorder/50'
              }`}
            >
              <BookOpen size={18} />
              <span>公开博客管理</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('users')
                setIsEditing(false)
              }}
              className={`flex-shrink-0 lg:w-full flex items-center space-x-2 lg:space-x-3 px-4 py-2.5 lg:py-3 rounded-xl transition-colors text-sm lg:text-base whitespace-nowrap ${
                activeTab === 'users'
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-onSurface/70 dark:text-foreground/70 hover:bg-secondary/50 dark:hover:bg-darkBorder/50'
              }`}
            >
              <Users size={18} />
              <span>用户账号管理</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('configs')
                setIsEditing(false)
              }}
              className={`flex-shrink-0 lg:w-full flex items-center space-x-2 lg:space-x-3 px-4 py-2.5 lg:py-3 rounded-xl transition-colors text-sm lg:text-base whitespace-nowrap ${
                activeTab === 'configs'
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-onSurface/70 dark:text-foreground/70 hover:bg-secondary/50 dark:hover:bg-darkBorder/50'
              }`}
            >
              <Settings size={18} />
              <span>系统全局配置</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('quota')
                setIsEditing(false)
              }}
              className={`flex-shrink-0 lg:w-full flex items-center space-x-2 lg:space-x-3 px-4 py-2.5 lg:py-3 rounded-xl transition-colors text-sm lg:text-base whitespace-nowrap ${
                activeTab === 'quota'
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-onSurface/70 dark:text-foreground/70 hover:bg-secondary/50 dark:hover:bg-darkBorder/50'
              }`}
            >
              <Database size={18} />
              <span>配额与邀请码</span>
            </button>
          </div>

          {/* Admin Panels Workspace */}
          <div className="flex-1 min-h-[500px]">
            {/* ======================================= */}
            {/* ============ TAB 1: BLOGS ============= */}
            {/* ======================================= */}
            {activeTab === 'blog' && (
              <div className="space-y-6">
                {!isEditing ? (
                  <div className="space-y-6 animate-fade-in">
                    {/* Metrics Bar */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="p-6 rounded-2xl border border-secondary dark:border-darkBorder bg-white dark:bg-darkCard shadow-sm">
                        <p className="text-xs text-onSurface/50 dark:text-foreground/50 font-medium">总写随笔</p>
                        <h4 className="text-3xl font-display font-bold text-onSurface dark:text-foreground mt-2">{totalPosts} 篇</h4>
                      </div>
                      <div className="p-6 rounded-2xl border border-secondary dark:border-darkBorder bg-white dark:bg-darkCard shadow-sm">
                        <p className="text-xs text-onSurface/50 dark:text-foreground/50 font-medium">已发布随笔</p>
                        <h4 className="text-3xl font-display font-bold text-emerald-500 mt-2">{publishedPosts} 篇</h4>
                      </div>
                      <div className="p-6 rounded-2xl border border-secondary dark:border-darkBorder bg-white dark:bg-darkCard shadow-sm">
                        <p className="text-xs text-onSurface/50 dark:text-foreground/50 font-medium">累计阅读量</p>
                        <h4 className="text-3xl font-display font-bold text-indigo-500 mt-2">{totalViews} 次</h4>
                      </div>
                    </div>

                    {/* Table Title and Actions */}
                    <div className="flex items-center justify-between pt-4 pb-2 border-b border-secondary dark:border-darkBorder">
                      <h2 className="text-xl font-bold text-onSurface dark:text-foreground">随笔文章</h2>
                      <Button onClick={handleOpenCreate} size="sm" className="shadow-sm">
                        <Plus size={16} className="mr-1" /> 新建随笔
                      </Button>
                    </div>

                    {/* Blog Posts Data Table */}
                    {loadingPosts ? (
                      <div className="py-20 flex justify-center">
                        <Loader2 className="animate-spin text-primary h-8 w-8" />
                      </div>
                    ) : posts.length === 0 ? (
                      <div className="text-center py-20 border border-dashed border-secondary dark:border-darkBorder rounded-2xl bg-white/20 dark:bg-darkCard/10">
                        <BookOpen className="h-10 w-10 text-onSurface/30 dark:text-foreground/30 mx-auto mb-3 animate-pulse" />
                        <h4 className="text-base font-bold text-onSurface dark:text-foreground">无随笔内容</h4>
                        <p className="text-xs text-onSurface/55 dark:text-foreground/55 mt-1">点击右上角“新建随笔”开启博客分享。</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto rounded-2xl border border-secondary dark:border-darkBorder bg-white dark:bg-darkCard shadow-sm">
                        <table className="w-full text-left text-sm">
                          <thead className="bg-secondary/40 dark:bg-darkBg text-onSurface/70 dark:text-foreground/70 border-b border-secondary dark:border-darkBorder">
                            <tr>
                              <th className="px-5 py-3 font-semibold">文章标题</th>
                              <th className="px-5 py-3 font-semibold">链接标识 (Slug)</th>
                              <th className="px-5 py-3 font-semibold text-center">状态</th>
                              <th className="px-5 py-3 font-semibold text-center">阅读量</th>
                              <th className="px-5 py-3 font-semibold">发布日期</th>
                              <th className="px-5 py-3 font-semibold text-center">操作</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-secondary dark:divide-darkBorder">
                            {posts.map((post) => (
                              <tr key={post.id} className="hover:bg-secondary/10 dark:hover:bg-darkBorder/10 transition-colors">
                                <td className="px-5 py-4 font-bold text-onSurface dark:text-foreground max-w-[200px] truncate">
                                  {post.title}
                                </td>
                                <td className="px-5 py-4 font-mono text-xs text-primary max-w-[150px] truncate">
                                  {post.slug}
                                </td>
                                <td className="px-5 py-4 text-center">
                                  <div className="flex justify-center gap-1.5">
                                    {post.is_published ? (
                                      <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold border border-emerald-200 dark:border-emerald-500/20">已发布</span>
                                    ) : (
                                      <span className="text-[10px] px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold border border-amber-200 dark:border-amber-500/20">草稿</span>
                                    )}
                                    {post.is_public && (
                                      <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-semibold border border-indigo-200 dark:border-indigo-500/20 flex items-center gap-0.5"><Globe size={8}/>公开</span>
                                    )}
                                  </div>
                                </td>
                                <td className="px-5 py-4 text-center text-onSurface dark:text-foreground">
                                  <span className="inline-flex items-center gap-1"><Eye size={12}/>{post.view_count}</span>
                                </td>
                                <td className="px-5 py-4 text-xs text-onSurface/60 dark:text-foreground/60">
                                  {post.published_at ? new Date(post.published_at).toLocaleString() : '—'}
                                </td>
                                <td className="px-5 py-4">
                                  <div className="flex items-center justify-center space-x-2">
                                    <button
                                      onClick={() => handleOpenEdit(post)}
                                      className="p-1.5 bg-secondary/50 dark:bg-darkBorder hover:bg-primary/10 hover:text-primary text-onSurface/75 dark:text-foreground/75 rounded-lg transition-colors"
                                      title="编辑文章"
                                    >
                                      <Edit size={14} />
                                    </button>
                                    <button
                                      onClick={() => handleDeletePost(post.id)}
                                      className="p-1.5 bg-red-50 dark:bg-red-500/10 hover:bg-red-500 hover:text-white text-red-500 rounded-lg transition-colors"
                                      title="删除文章"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ) : (
                  // ----- BLOG EDIT / CREATE FORM -----
                  <div className="space-y-6 animate-fade-in">
                    <div className="flex items-center justify-between pb-3 border-b border-secondary dark:border-darkBorder">
                      <h3 className="text-lg font-bold text-onSurface dark:text-foreground">
                        {editingPostId === null ? '新建随笔' : '修改随笔文章'}
                      </h3>
                      <div className="flex gap-2">
                        <Button onClick={() => setIsEditing(false)} variant="ghost" size="sm">
                          返回列表
                        </Button>
                        <Button onClick={handleSavePost} isLoading={actionLoading} size="sm" className="shadow-sm">
                          <Save size={16} className="mr-1" /> 保存内容
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <div>
                          <label className="block text-xs font-semibold text-onSurface/70 dark:text-foreground/70 mb-1">文章标题 *</label>
                          <input
                            type="text"
                            placeholder="输入文章标题"
                            value={formTitle}
                            onChange={(e) => setFormTitle(e.target.value)}
                            className="w-full rounded-xl border border-secondary dark:border-darkBorder bg-white dark:bg-darkCard px-4 py-2.5 text-sm text-onSurface dark:text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
                            maxLength={300}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-onSurface/70 dark:text-foreground/70 mb-1">链接标识 (Slug) *</label>
                          <input
                            type="text"
                            placeholder="例如: love-letter-2026"
                            value={formSlug}
                            onChange={(e) => setFormSlug(e.target.value.toLowerCase().replace(/[^a-z0-9\-]/g, '-'))}
                            className="w-full rounded-xl border border-secondary dark:border-darkBorder bg-white dark:bg-darkCard px-4 py-2.5 text-sm text-onSurface dark:text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary/50"
                            maxLength={300}
                          />
                          <p className="text-[10px] text-onSurface/45 dark:text-foreground/45 mt-1">仅可使用小写英文字母、数字和减号，它是博客详情页面的唯一 URL 尾椎。</p>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-onSurface/70 dark:text-foreground/70 mb-1">封面大图 URL (可选)</label>
                          <input
                            type="text"
                            placeholder="http://example.com/cover.jpg"
                            value={formCoverUrl}
                            onChange={(e) => setFormCoverUrl(e.target.value)}
                            className="w-full rounded-xl border border-secondary dark:border-darkBorder bg-white dark:bg-darkCard px-4 py-2.5 text-sm text-onSurface dark:text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
                            maxLength={500}
                          />
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div>
                          <label className="block text-xs font-semibold text-onSurface/70 dark:text-foreground/70 mb-1">文章标签 Tags (多标签使用英文逗号分隔)</label>
                          <input
                            type="text"
                            placeholder="生活, 旅游, 情感"
                            value={formTags}
                            onChange={(e) => setFormTags(e.target.value)}
                            className="w-full rounded-xl border border-secondary dark:border-darkBorder bg-white dark:bg-darkCard px-4 py-2.5 text-sm text-onSurface dark:text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-onSurface/70 dark:text-foreground/70 mb-1">文章摘要 Excerpt (可选)</label>
                          <textarea
                            rows={3}
                            placeholder="请输入段落摘要，用于展示在博客卡片介绍中..."
                            value={formExcerpt}
                            onChange={(e) => setFormExcerpt(e.target.value)}
                            className="w-full rounded-xl border border-secondary dark:border-darkBorder bg-white dark:bg-darkCard px-4 py-2.5 text-sm text-onSurface dark:text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 resize-none"
                          />
                        </div>

                        {/* Status Checkboxes */}
                        <div className="flex gap-6 p-4 rounded-xl border border-secondary dark:border-darkBorder bg-white dark:bg-darkCard">
                          <label className="flex items-center space-x-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={formIsPublic}
                              onChange={(e) => setFormIsPublic(e.target.checked)}
                              className="rounded border-secondary text-primary focus:ring-primary/50"
                            />
                            <span className="text-xs font-semibold text-onSurface dark:text-foreground">公开可见 (Public)</span>
                          </label>

                          <label className="flex items-center space-x-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={formIsPublished}
                              onChange={(e) => setFormIsPublished(e.target.checked)}
                              className="rounded border-secondary text-primary focus:ring-primary/50"
                            />
                            <span className="text-xs font-semibold text-onSurface dark:text-foreground">发布文章 (Published)</span>
                          </label>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold text-onSurface/70 dark:text-foreground/70">正文内容 *</label>
                      <div className="min-h-[500px] flex flex-col rounded-2xl border border-secondary dark:border-darkBorder overflow-hidden bg-white dark:bg-darkCard shadow-sm" data-color-mode={isDark ? 'dark' : 'light'}>
                        <MDEditor
                          value={formContent}
                          onChange={setFormContent}
                          height="100%"
                          minHeight={500}
                          preview="live"
                          className="flex-1 bg-white dark:bg-darkCard text-onSurface dark:text-foreground border-none"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ======================================= */}
            {/* ============ TAB 2: USERS ============= */}
            {/* ======================================= */}
            {activeTab === 'users' && (
              <div className="space-y-6 animate-fade-in">
                <div className="pb-3 border-b border-secondary dark:border-darkBorder flex items-center justify-between">
                  <h2 className="text-xl font-bold text-onSurface dark:text-foreground">用户账号管理</h2>
                </div>

                {loadingUsers ? (
                  <div className="py-20 flex justify-center">
                    <Loader2 className="animate-spin text-primary h-8 w-8" />
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-2xl border border-secondary dark:border-darkBorder bg-white dark:bg-darkCard shadow-sm">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-secondary/40 dark:bg-darkBg text-onSurface/70 dark:text-foreground/70 border-b border-secondary dark:border-darkBorder">
                        <tr>
                          <th className="px-5 py-3 font-semibold">基本信息</th>
                          <th className="px-5 py-3 font-semibold">电子邮箱</th>
                          <th className="px-5 py-3 font-semibold">角色</th>
                          <th className="px-5 py-3 font-semibold">加入时间</th>
                          <th className="px-5 py-3 font-semibold text-center">账号状态</th>
                          <th className="px-5 py-3 font-semibold text-center">快捷控制</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-secondary dark:divide-darkBorder">
                        {users.map((targetUser) => (
                          <tr key={targetUser.id} className="hover:bg-secondary/10 dark:hover:bg-darkBorder/10 transition-colors">
                            <td className="px-5 py-4 font-bold text-onSurface dark:text-foreground">
                              <div className="flex items-center space-x-2.5">
                                <div className="h-8 w-8 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold uppercase">
                                  {targetUser.avatar_url ? (
                                    <img src={targetUser.avatar_url} alt={targetUser.username} className="h-8 w-8 rounded-full object-cover" />
                                  ) : (
                                    (targetUser.display_name || targetUser.username).charAt(0)
                                  )}
                                </div>
                                <div>
                                  <p className="font-semibold">{targetUser.display_name || targetUser.username}</p>
                                  <p className="text-[10px] text-onSurface/40 dark:text-foreground/45 font-mono">ID: {targetUser.id}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-5 py-4 text-onSurface dark:text-foreground font-mono text-xs">
                              {targetUser.email}
                            </td>
                            <td className="px-5 py-4">
                              {targetUser.is_root ? (
                                <span className="inline-flex items-center text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-red-500/10 text-red-500 border border-red-500/20">
                                  <ShieldCheck size={10} className="mr-0.5" />
                                  超管
                                </span>
                              ) : (
                                <span className="inline-flex items-center text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-secondary text-onSurface/60 dark:bg-darkBorder dark:text-foreground/60">
                                  普通用户
                                </span>
                              )}
                            </td>
                            <td className="px-5 py-4 text-xs text-onSurface/60 dark:text-foreground/60">
                              {new Date(targetUser.created_at).toLocaleString()}
                            </td>
                            <td className="px-5 py-4 text-center">
                              {targetUser.is_active ? (
                                <span className="inline-flex items-center text-[10px] px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold border border-emerald-200 dark:border-emerald-500/20">正常</span>
                              ) : (
                                <span className="inline-flex items-center text-[10px] px-2 py-0.5 rounded bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 font-semibold border border-red-200 dark:border-red-500/20">已禁用</span>
                              )}
                            </td>
                            <td className="px-5 py-4">
                              <div className="flex items-center justify-center">
                                <button
                                  onClick={() => handleToggleUserStatus(targetUser)}
                                  disabled={targetUser.id === user?.id || targetUser.is_root}
                                  className={`p-1.5 rounded-lg transition-colors flex items-center justify-center gap-1 text-xs font-medium border ${
                                    targetUser.id === user?.id || targetUser.is_root
                                      ? 'opacity-40 cursor-not-allowed text-onSurface/40 border-secondary/40'
                                      : targetUser.is_active
                                      ? 'text-red-500 bg-red-50 hover:bg-red-500 hover:text-white dark:bg-red-500/10 border-red-500/25'
                                      : 'text-emerald-500 bg-emerald-50 hover:bg-emerald-500 hover:text-white dark:bg-emerald-500/10 border-emerald-500/25'
                                  }`}
                                  title={targetUser.is_active ? "禁用账号" : "恢复启用"}
                                >
                                  {targetUser.is_active ? (
                                    <>
                                      <UserMinus size={14} />
                                      <span>禁用</span>
                                    </>
                                  ) : (
                                    <>
                                      <UserCheck size={14} />
                                      <span>启用</span>
                                    </>
                                  )}
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* ======================================= */}
            {/* =========== TAB 3: CONFIGS ============ */}
            {/* ======================================= */}
            {activeTab === 'configs' && (
              <div className="space-y-6 animate-fade-in">
                <div className="pb-3 border-b border-secondary dark:border-darkBorder">
                  <h2 className="text-xl font-bold text-onSurface dark:text-foreground">全局系统设置</h2>
                  <p className="text-xs text-onSurface/55 dark:text-foreground/55 mt-1">
                    系统服务与第三方 API 密钥中心。带有脱敏星号保护的密钥如果不需要修改，请勿填入新值保存。
                  </p>
                </div>

                {loadingConfigs ? (
                  <div className="py-20 flex justify-center">
                    <Loader2 className="animate-spin text-primary h-8 w-8" />
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-6">
                    {configs.map((config) => {
                      const isSensitive = ['qwen_api_key', 'deepseek_api_key', 'lsky_api_token'].includes(config.config_key)
                      const isVisible = visibleKeys[config.config_key] || false
                      
                      return (
                        <div
                          key={config.id}
                          className="p-6 rounded-2xl border border-secondary dark:border-darkBorder bg-white dark:bg-darkCard flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-sm hover:shadow-md transition-shadow"
                        >
                          <div className="space-y-1 flex-1">
                            <h4 className="font-bold text-sm text-onSurface dark:text-foreground uppercase tracking-wide">
                              {config.config_key}
                            </h4>
                            <p className="text-xs text-onSurface/60 dark:text-foreground/60 leading-relaxed">
                              {config.description || '暂无详细描述...'}
                            </p>
                            
                            {/* Input Form field Area */}
                            <div className="pt-2 flex items-center space-x-2 max-w-xl">
                              <input
                                type={isSensitive && !isVisible ? 'password' : 'text'}
                                value={configValues[config.config_key] || ''}
                                onChange={(e) =>
                                  setConfigValues((prev) => ({
                                    ...prev,
                                    [config.config_key]: e.target.value,
                                  }))
                                }
                                placeholder="请输入配置内容值"
                                className="flex-1 rounded-xl border border-secondary dark:border-darkBorder bg-surface dark:bg-darkBg px-3 py-2 text-xs font-mono text-onSurface dark:text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
                              />
                              {isSensitive && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setVisibleKeys((prev) => ({
                                      ...prev,
                                      [config.config_key]: !isVisible,
                                    }))
                                  }
                                  className="px-2.5 py-2 text-xs rounded-xl bg-secondary/60 hover:bg-secondary dark:bg-darkBorder/60 dark:hover:bg-darkBorder text-onSurface/70 dark:text-foreground/80 transition-colors"
                                >
                                  {isVisible ? '隐藏' : '明文'}
                                </button>
                              )}
                            </div>
                          </div>

                          <div className="shrink-0 flex items-center md:pt-4">
                            <Button
                              onClick={() => handleSaveConfig(config.config_key)}
                              disabled={configValues[config.config_key] === config.config_val}
                              size="sm"
                              className="shadow-sm"
                            >
                              <Save size={14} className="mr-1" />
                              更新配置
                            </Button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ======================================= */}
            {/* ============ TAB 4: QUOTAS ============= */}
            {/* ======================================= */}
            {activeTab === 'quota' && (
              <div className="space-y-8 animate-fade-in">
                {/* 1. Global storage quota */}
                <div className="space-y-4">
                  <div className="pb-3 border-b border-secondary dark:border-darkBorder">
                    <h2 className="text-xl font-bold text-onSurface dark:text-foreground">图床空间配额管理</h2>
                  </div>

                  {loadingQuota ? (
                    <div className="py-10 flex justify-center">
                      <Loader2 className="animate-spin text-primary h-8 w-8" />
                    </div>
                  ) : quota ? (
                    <div className="p-6 rounded-2xl border border-secondary dark:border-darkBorder bg-white dark:bg-darkCard space-y-4 max-w-xl shadow-sm">
                      <div className="flex items-center space-x-2 text-onSurface dark:text-foreground font-semibold">
                        <Database className="text-primary h-5 w-5" />
                        <h3>系统存储详情</h3>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs text-onSurface/60 dark:text-foreground/60">
                          <span>已占用: {quota.used_size_mb.toFixed(2)} MB</span>
                          <span>总配额容量限制: {quota.max_size_mb.toFixed(2)} MB</span>
                        </div>
                        <div className="w-full bg-secondary dark:bg-darkBg rounded-full h-3">
                          <div
                            className="bg-primary h-3 rounded-full transition-all duration-500"
                            style={{ width: `${Math.min((quota.used_size_mb / quota.max_size_mb) * 100, 100)}%` }}
                          ></div>
                        </div>
                      </div>

                      <div className="flex items-end gap-3 pt-2">
                        <div className="flex-1">
                          <label className="block text-xs font-semibold text-onSurface/70 dark:text-foreground/70 mb-1">修改全局存储上限 (MB)</label>
                          <input
                            type="number"
                            value={quotaInput}
                            onChange={(e) => setQuotaInput(e.target.value)}
                            placeholder="例如: 1024"
                            className="w-full rounded-xl border border-secondary dark:border-darkBorder bg-surface dark:bg-darkBg px-4 py-2.5 text-xs text-onSurface dark:text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
                          />
                        </div>
                        <Button onClick={handleUpdateQuota} size="sm">
                          更新配额
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </div>

                {/* 2. Global invite codes */}
                <div className="space-y-4">
                  <div className="pb-3 border-b border-secondary dark:border-darkBorder flex items-center justify-between">
                    <h2 className="text-xl font-bold text-onSurface dark:text-foreground">注册邀请码中心</h2>
                  </div>

                  {/* Create code widget */}
                  <div className="p-6 rounded-2xl border border-secondary dark:border-darkBorder bg-white dark:bg-darkCard max-w-xl space-y-4 shadow-sm">
                    <h3 className="font-bold text-sm text-onSurface dark:text-foreground flex items-center gap-1">
                      <Key size={16} className="text-primary" /> 生成单次邀请注册码
                    </h3>
                    <div className="flex items-end gap-3">
                      <div className="flex-1">
                        <label className="block text-xs font-semibold text-onSurface/70 dark:text-foreground/70 mb-1">失效时间限制 (小时, 空则永久有效)</label>
                        <input
                          type="number"
                          value={inviteExpireHours}
                          onChange={(e) => setInviteExpireHours(parseInt(e.target.value) || 0)}
                          placeholder="例如: 24 (小时)"
                          min={1}
                          className="w-full rounded-xl border border-secondary dark:border-darkBorder bg-surface dark:bg-darkBg px-4 py-2.5 text-xs text-onSurface dark:text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
                        />
                      </div>
                      <Button onClick={handleCreateInviteCode} isLoading={creatingInvite} size="sm">
                        确认生成
                      </Button>
                    </div>
                  </div>

                  {/* Table of invite codes */}
                  {loadingInvites ? (
                    <div className="py-20 flex justify-center">
                      <Loader2 className="animate-spin text-primary h-8 w-8" />
                    </div>
                  ) : inviteCodes.length === 0 ? (
                    <div className="text-center py-10 border border-dashed border-secondary dark:border-darkBorder rounded-2xl bg-white/20 dark:bg-darkCard/10 max-w-3xl">
                      <p className="text-xs text-onSurface/55 dark:text-foreground/55">当前无邀请码记录。可以通过上方快捷表单进行生成。</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-2xl border border-secondary dark:border-darkBorder bg-white dark:bg-darkCard max-w-4xl shadow-sm">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-secondary/40 dark:bg-darkBg text-onSurface/70 dark:text-foreground/70 border-b border-secondary dark:border-darkBorder">
                          <tr>
                            <th className="px-5 py-3 font-semibold">邀请激活码</th>
                            <th className="px-5 py-3 font-semibold">注册状态</th>
                            <th className="px-5 py-3 font-semibold">使用用户 ID</th>
                            <th className="px-5 py-3 font-semibold">使用时间</th>
                            <th className="px-5 py-3 font-semibold">失效日期</th>
                            <th className="px-5 py-3 font-semibold">创建日期</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-secondary dark:divide-darkBorder">
                          {inviteCodes.map((codeObj) => {
                            const isExpired = codeObj.expires_at && new Date(codeObj.expires_at).getTime() < new Date().getTime()
                            const isUsed = codeObj.used_by !== null
                            
                            return (
                              <tr key={codeObj.id} className="hover:bg-secondary/10 dark:hover:bg-darkBorder/10 transition-colors">
                                <td className="px-5 py-3 font-mono text-xs text-primary font-bold flex items-center">
                                  <span>{codeObj.code.slice(0, 8)}...{codeObj.code.slice(-4)}</span>
                                  <button
                                    onClick={() => copyToClipboard(codeObj.code)}
                                    className="ml-2 text-onSurface/40 hover:text-primary transition-colors"
                                    title="复制完整激活码"
                                  >
                                    {copiedCode === codeObj.code ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                                  </button>
                                </td>
                                <td className="px-5 py-3">
                                  {isUsed ? (
                                    <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold border border-emerald-200 dark:border-emerald-500/20">已使用</span>
                                  ) : isExpired ? (
                                    <span className="text-[10px] px-2 py-0.5 rounded bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 font-semibold border border-red-200 dark:border-red-500/20">已过期</span>
                                  ) : (
                                    <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-semibold border border-indigo-200 dark:border-indigo-500/20">未使用</span>
                                  )}
                                </td>
                                <td className="px-5 py-3 font-mono text-xs text-onSurface/80 dark:text-foreground/80 text-center">
                                  {codeObj.used_by || '—'}
                                </td>
                                <td className="px-5 py-3 text-xs text-onSurface/60 dark:text-foreground/60">
                                  {codeObj.used_at ? new Date(codeObj.used_at).toLocaleString() : '—'}
                                </td>
                                <td className="px-5 py-3 text-xs text-onSurface/60 dark:text-foreground/60">
                                  {codeObj.expires_at ? new Date(codeObj.expires_at).toLocaleString() : '永久'}
                                </td>
                                <td className="px-5 py-3 text-xs text-onSurface/60 dark:text-foreground/60">
                                  {new Date(codeObj.created_at).toLocaleDateString()}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
