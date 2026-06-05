'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  ShieldAlert, Settings, Users, Key, Database, BookOpen, Plus, Loader2,
  Trash2, Edit, ArrowLeft, Save, Globe, Eye, CheckCircle, AlertCircle,
  Copy, Check, UserMinus, UserCheck, ShieldCheck, ToggleLeft, ToggleRight, Share2
} from 'lucide-react'
import dynamic from 'next/dynamic'
import { useAuth } from '@/hooks/useAuth'
import { useTheme } from '@/hooks/useTheme'
import api from '@/lib/api'
import Button from '@/components/ui/Button'
import ThemeToggle from '@/components/layout/ThemeToggle'
import { copyText } from '@/lib/utils'

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
  can_create_spaces: boolean
  is_discipline_authorized: boolean
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

interface AIProvider {
  id: string
  name: string
  base_url: string
  api_key: string
  model?: string
  models: string[]
  is_reachable?: boolean
  last_checked?: string
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
  const [copiedShareSlug, setCopiedShareSlug] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [isSourceMode, setIsSourceMode] = useState(false)
  const [aiProviders, setAiProviders] = useState<AIProvider[]>([])
  const [editingProvider, setEditingProvider] = useState<AIProvider | null>(null)
  const [isProviderModalOpen, setIsProviderModalOpen] = useState(false)
  const [providerForm, setProviderForm] = useState<AIProvider>({ id: '', name: '', base_url: '', api_key: '', models: [] })
  const [modelsInput, setModelsInput] = useState('')
  const [checkingAll, setCheckingAll] = useState(false)
  const [testingProviderId, setTestingProviderId] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<Record<string, { status: 'success' | 'error'; message: string }>>({})
  const [fetchingModelsId, setFetchingModelsId] = useState<string | null>(null)
  const [fetchedModels, setFetchedModels] = useState<Record<string, string[]>>({})
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const mdInputRef = React.useRef<HTMLInputElement>(null)

  const handleImportMarkdown = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    
    const file = files[0]
    const formData = new FormData()
    formData.append('file', file)
    
    setActionLoading(true)
    try {
      const res = await api.post('/admin/blog/parse-markdown', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      })
      const { meta, content } = res.data
      
      setEditingPostId(null)
      setFormTitle(meta.title || '')
      setFormSlug(meta.slug || '')
      setFormContent(content || '')
      setFormCoverUrl(meta.cover_url || '')
      setFormExcerpt(meta.excerpt || '')
      setFormTags(meta.tags ? meta.tags.join(', ') : '')
      setFormIsPublic(true)
      setFormIsPublished(false)
      setIsEditing(true)
      
      showToast('success', 'Markdown 导入成功！')
    } catch (err: any) {
      showToast('error', err.response?.data?.detail || '解析 Markdown 失败。')
    } finally {
      setActionLoading(false)
      if (mdInputRef.current) {
        mdInputRef.current.value = ''
      }
    }
  }

  const handleCopyShareLink = async (slug: string) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    const shareUrl = `${origin}/blog/${slug}`
    const success = await copyText(shareUrl)
    if (success) {
      setCopiedShareSlug(slug)
      showToast('success', '已复制分享链接！')
      setTimeout(() => setCopiedShareSlug(null), 2000)
    } else {
      showToast('error', '复制失败，请手动复制。')
    }
  }

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

      const aiProvidersConfig = res.data.find((c: any) => c.config_key === 'ai_providers')
      if (aiProvidersConfig && aiProvidersConfig.config_val) {
        try {
          const parsed = JSON.parse(aiProvidersConfig.config_val)
          if (Array.isArray(parsed)) {
            setAiProviders(parsed)
          }
        } catch (e) {
          console.error('Failed to parse ai_providers', e)
        }
      } else {
        setAiProviders([])
      }
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

  const handleToggleUserSpacePermission = async (targetUser: UserResponse) => {
    if (targetUser.id === user?.id) {
      alert('不能修改超级管理员自身的创建空间权限。')
      return
    }
    try {
      const newPermission = !targetUser.can_create_spaces
      await api.patch(`/admin/users/${targetUser.id}`, { can_create_spaces: newPermission })
      showToast('success', `已${newPermission ? '开通' : '取消'}用户 ${targetUser.username} 的创建空间权限`)
      setUsers((prev) =>
        prev.map((u) => (u.id === targetUser.id ? { ...u, can_create_spaces: newPermission } : u))
      )
    } catch (err: any) {
      showToast('error', err.response?.data?.detail || '权限更新失败。')
    }
  }

  const handleToggleUserDisciplinePermission = async (targetUser: UserResponse) => {
    if (targetUser.id === user?.id) {
      alert('不能修改超级管理员自身的自律记录权限。')
      return
    }
    try {
      const newPermission = !targetUser.is_discipline_authorized
      await api.patch(`/admin/users/${targetUser.id}`, { is_discipline_authorized: newPermission })
      showToast('success', `已${newPermission ? '开通' : '取消'}用户 ${targetUser.username} 的自律记录权限`)
      setUsers((prev) =>
        prev.map((u) => (u.id === targetUser.id ? { ...u, is_discipline_authorized: newPermission } : u))
      )
    } catch (err: any) {
      showToast('error', err.response?.data?.detail || '权限更新失败。')
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

  const handleSaveAIProviders = async (updatedProviders: AIProvider[]) => {
    try {
      const configVal = JSON.stringify(updatedProviders)
      const res = await api.patch('/admin/configs/ai_providers', { config_val: configVal })
      showToast('success', 'AI 服务商配置保存成功！')
      
      const savedProviders = JSON.parse(res.data.config_val || '[]')
      setAiProviders(savedProviders)
      setConfigs(prev => {
        const existing = prev.find(c => c.config_key === 'ai_providers')
        if (existing) {
          return prev.map(c => c.config_key === 'ai_providers' ? { ...c, config_val: res.data.config_val } : c)
        } else {
          return [...prev, { id: res.data.id, config_key: 'ai_providers', config_val: res.data.config_val, description: res.data.description, updated_at: res.data.updated_at } as any]
        }
      })
      setConfigValues(prev => ({ ...prev, ai_providers: res.data.config_val || '' }))
    } catch (err: any) {
      showToast('error', err.response?.data?.detail || '保存 AI 配置失败。')
    }
  }

  const handleTestConnection = async (provider: AIProvider) => {
    setTestingProviderId(provider.id)
    setTestResult(prev => ({ ...prev, [provider.id]: undefined as any }))
    
    let testModel = 'gpt-3.5-turbo'
    if (provider.models && provider.models.length > 0) {
      testModel = provider.models[0]
    } else if (provider.model) {
      testModel = provider.model
    }

    try {
      const res = await api.post('/admin/ai/test-connection', {
        id: provider.id,
        base_url: provider.base_url || null,
        api_key: provider.api_key,
        model: testModel,
      })
      if (res.data.status === 'success') {
        setTestResult(prev => ({ ...prev, [provider.id]: { status: 'success', message: res.data.message } }))
      } else {
        setTestResult(prev => ({ ...prev, [provider.id]: { status: 'error', message: res.data.message } }))
      }
    } catch (err: any) {
      setTestResult(prev => ({
        ...prev,
        [provider.id]: { status: 'error', message: err.response?.data?.detail || '请求失败' }
      }))
    } finally {
      setTestingProviderId(null)
    }
  }

  const handleFetchModels = async (provider: AIProvider, autoSave = true) => {
    setFetchingModelsId(provider.id)
    try {
      const res = await api.post('/admin/ai/models', {
        id: provider.id,
        base_url: provider.base_url || null,
        api_key: provider.api_key,
      })
      if (res.data.status === 'success' && Array.isArray(res.data.models)) {
        setFetchedModels(prev => ({ ...prev, [provider.id]: res.data.models }))
        showToast('success', `成功获取 ${res.data.models.length} 个模型！`)
        
        if (autoSave) {
          const updated = aiProviders.map(p =>
            p.id === provider.id ? { ...p, models: res.data.models } : p
          )
          const oldModels = provider.models || []
          const isSame = oldModels.length === res.data.models.length && oldModels.every((m, idx) => m === res.data.models[idx])
          if (!isSame) {
            handleSaveAIProviders(updated)
          }
        }
      }
    } catch (err: any) {
      showToast('error', err.response?.data?.detail || '获取模型列表失败，请检查配置。')
    } finally {
      setFetchingModelsId(null)
    }
  }

  const handleFetchModelsForForm = async () => {
    if (!providerForm.api_key) {
      alert('请先输入 API Key！')
      return
    }
    const tempId = providerForm.id || 'temp'
    setFetchingModelsId(tempId)
    try {
      const res = await api.post('/admin/ai/models', {
        id: providerForm.id,
        base_url: providerForm.base_url || null,
        api_key: providerForm.api_key,
      })
      if (res.data.status === 'success' && Array.isArray(res.data.models)) {
        setModelsInput(res.data.models.join(', '))
        if (!providerForm.model && res.data.models.length > 0) {
          setProviderForm(prev => ({ ...prev, model: res.data.models[0] }))
        }
        showToast('success', `自动获取成功，共 ${res.data.models.length} 个模型！`)
      }
    } catch (err: any) {
      showToast('error', err.response?.data?.detail || '获取模型列表失败，请检查配置。')
    } finally {
      setFetchingModelsId(null)
    }
  }

  const handleCheckAllReachability = async () => {
    setCheckingAll(true)
    try {
      const res = await api.post('/admin/ai/check-all')
      if (res.data.status === 'success') {
        setAiProviders(res.data.providers)
        showToast('success', '所有服务商连通性检测完成！')
      }
    } catch (err: any) {
      showToast('error', err.response?.data?.detail || '连通性检测失败。')
    } finally {
      setCheckingAll(false)
    }
  }

  // Auto detect and fetch models for any provider with empty models list
  useEffect(() => {
    if (!loadingConfigs && aiProviders.length > 0) {
      const firstEmptyProvider = aiProviders.find(p => (!p.models || p.models.length === 0) && fetchingModelsId !== p.id)
      if (firstEmptyProvider) {
        handleFetchModels(firstEmptyProvider, true)
      }
    }
  }, [aiProviders, loadingConfigs, fetchingModelsId])

  const handleAddOrEditProvider = (provider: AIProvider) => {
    let updated: AIProvider[]
    if (aiProviders.some(p => p.id === provider.id)) {
      updated = aiProviders.map(p => p.id === provider.id ? provider : p)
    } else {
      updated = [...aiProviders, provider]
    }
    handleSaveAIProviders(updated)
    setIsProviderModalOpen(false)
    setEditingProvider(null)
  }

  const handleDeleteProvider = (id: string) => {
    if (!confirm('确定要删除该 AI 服务商配置吗？')) return
    const updated = aiProviders.filter(p => p.id !== id)
    handleSaveAIProviders(updated)
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

  const copyToClipboard = async (text: string) => {
    const success = await copyText(text)
    if (success) {
      setCopiedCode(text)
      showToast('success', '已复制到剪贴板！')
      setTimeout(() => setCopiedCode(null), 2000)
    } else {
      showToast('error', '复制失败，请手动复制。')
    }
  }

  const handleCopyInviteCode = async (code: string) => {
    const inviterName = user?.display_name || user?.username || '我'
    const registerUrl = typeof window !== 'undefined' ? `${window.location.origin}/register` : ''
    const textToCopy = `${inviterName}邀请你注册加入他的私人庄园，注册地址 “${registerUrl}” 邀请码为：${code}`
    const success = await copyText(textToCopy)
    if (success) {
      setCopiedCode(code)
      showToast('success', '已复制邀请激活文本！')
      setTimeout(() => setCopiedCode(null), 2000)
    } else {
      showToast('error', '复制失败，请手动复制。')
    }
  }

  // Blog Tab Actions
  const handleOpenCreate = () => {
    setEditingPostId(null)
    setFormTitle('')
    setFormSlug('')
    setFormContent('# 新文章\n\n')
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
          <div className="w-full lg:w-64 flex-shrink-0 flex flex-row lg:flex-col lg:sticky lg:top-24 lg:h-fit overflow-x-auto lg:overflow-x-visible pb-3 lg:pb-0 gap-2 lg:gap-1.5 border-b border-secondary/40 lg:border-b-0 dark:border-darkBorder/40 scrollbar-none">
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
                      <div className="flex items-center gap-2">
                        <input
                          type="file"
                          ref={mdInputRef}
                          onChange={handleImportMarkdown}
                          accept=".md,.markdown"
                          className="hidden"
                        />
                        <Button
                          onClick={() => mdInputRef.current?.click()}
                          variant="ghost"
                          size="sm"
                          className="shadow-sm border border-secondary dark:border-darkBorder bg-white/50 dark:bg-darkCard/50"
                        >
                          导入 Markdown
                        </Button>
                        <Button onClick={handleOpenCreate} size="sm" className="shadow-sm">
                          <Plus size={16} className="mr-1" /> 新建随笔
                        </Button>
                      </div>
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
                                    {post.is_published && post.is_public && (
                                      <button
                                        onClick={() => handleCopyShareLink(post.slug)}
                                        className="p-1.5 bg-secondary/50 dark:bg-darkBorder hover:bg-indigo-500/10 hover:text-indigo-500 text-onSurface/75 dark:text-foreground/75 rounded-lg transition-colors"
                                        title="复制分享链接"
                                      >
                                        {copiedShareSlug === post.slug ? <Check size={14} className="text-emerald-500" /> : <Share2 size={14} />}
                                      </button>
                                    )}
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
                      <div className="flex items-center justify-between">
                        <label className="block text-xs font-semibold text-onSurface/70 dark:text-foreground/70">正文内容 *</label>
                        <button
                          type="button"
                          onClick={() => setIsSourceMode(!isSourceMode)}
                          className="text-xs bg-primary/10 text-primary hover:bg-primary/20 px-3 py-1 rounded-lg border border-primary/20 transition-all font-semibold"
                        >
                          {isSourceMode ? '常规模式 (Markdown)' : '源码模式 (Raw Edit)'}
                        </button>
                      </div>
                      <div className="h-[600px] flex flex-col rounded-2xl border border-secondary dark:border-darkBorder overflow-hidden bg-white dark:bg-darkCard shadow-sm" data-color-mode={isDark ? 'dark' : 'light'}>
                        {isSourceMode ? (
                          <textarea
                            value={formContent || ''}
                            onChange={(e) => setFormContent(e.target.value)}
                            placeholder="开始以 Markdown 源码编写文章..."
                            className="w-full h-full p-6 font-mono text-sm border-none bg-white dark:bg-darkCard text-onSurface dark:text-foreground focus:outline-none focus:ring-0 resize-none leading-relaxed"
                          />
                        ) : (
                          <MDEditor
                            value={formContent}
                            onChange={setFormContent}
                            height="100%"
                            minHeight={500}
                            preview="live"
                            className="flex-1 bg-white dark:bg-darkCard text-onSurface dark:text-foreground border-none"
                            textareaProps={{
                              placeholder: '开始写点什么吧...'
                            }}
                          />
                        )}
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
                          <th className="px-5 py-3 font-semibold text-center">创建空间权限</th>
                          <th className="px-5 py-3 font-semibold text-center">自律记录授权</th>
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
                            <td className="px-5 py-4 text-center">
                              <button
                                onClick={() => handleToggleUserSpacePermission(targetUser)}
                                disabled={targetUser.id === user?.id || targetUser.is_root}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-1 focus:ring-primary/40 ${
                                  targetUser.id === user?.id || targetUser.is_root
                                    ? 'opacity-40 cursor-not-allowed bg-secondary dark:bg-darkBorder'
                                    : targetUser.can_create_spaces
                                    ? 'bg-primary'
                                    : 'bg-onSurface/20 dark:bg-darkBorder'
                                }`}
                                title={targetUser.can_create_spaces ? "取消空间创建权限" : "开启空间创建权限"}
                              >
                                <span
                                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                    targetUser.can_create_spaces ? 'translate-x-6' : 'translate-x-1'
                                  }`}
                                />
                              </button>
                            </td>
                            <td className="px-5 py-4 text-center">
                              <button
                                onClick={() => handleToggleUserDisciplinePermission(targetUser)}
                                disabled={targetUser.id === user?.id || targetUser.is_root}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-1 focus:ring-primary/40 ${
                                  targetUser.id === user?.id || targetUser.is_root
                                    ? 'opacity-40 cursor-not-allowed bg-secondary dark:bg-darkBorder'
                                    : targetUser.is_discipline_authorized
                                    ? 'bg-primary'
                                    : 'bg-onSurface/20 dark:bg-darkBorder'
                                }`}
                                title={targetUser.is_discipline_authorized ? "取消自律记录授权" : "开通自律记录授权"}
                              >
                                <span
                                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                    targetUser.is_discipline_authorized ? 'translate-x-6' : 'translate-x-1'
                                  }`}
                                />
                              </button>
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
              <div className="space-y-10 animate-fade-in">
                {/* General Configs Area */}
                <div className="space-y-6">
                  <div className="pb-3 border-b border-secondary dark:border-darkBorder flex items-center justify-between">
                    <div>
                      <h2 className="text-xl font-bold text-onSurface dark:text-foreground">常规系统配置</h2>
                      <p className="text-xs text-onSurface/55 dark:text-foreground/55 mt-1">
                        系统基础服务及第三方图床等密钥配置。带有脱敏星号保护的密钥如果不需要修改，请勿填入新值保存。
                      </p>
                    </div>
                  </div>

                  {loadingConfigs ? (
                    <div className="py-10 flex justify-center">
                      <Loader2 className="animate-spin text-primary h-8 w-8" />
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-6">
                      {configs
                        .filter(
                          (c) =>
                            ![
                              'ai_providers',
                              'qwen_api_key',
                              'qwen_base_url',
                              'deepseek_api_key',
                              'deepseek_base_url',
                              'default_model'
                            ].includes(c.config_key)
                        )
                        .map((config) => {
                          const isSensitive =
                            ['lsky_api_token'].includes(config.config_key) ||
                            config.config_key.toLowerCase().includes('key') ||
                            config.config_key.toLowerCase().includes('token') ||
                            config.config_key.toLowerCase().includes('secret')
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

                {/* AI Config Area */}
                <div className="space-y-6 pt-4">
                  <div className="pb-3 border-b border-secondary dark:border-darkBorder flex items-center justify-between">
                    <div>
                      <h2 className="text-xl font-bold text-onSurface dark:text-foreground">AI 服务商与 API 管理</h2>
                      <p className="text-xs text-onSurface/55 dark:text-foreground/55 mt-1">
                        像 Chatbox 一样管理您的 AI 大模型服务商。在此处添加、修改或删除自定义 AI API 提供商。
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        onClick={handleCheckAllReachability}
                        disabled={checkingAll}
                        variant="ghost"
                        size="sm"
                      >
                        {checkingAll && <Loader2 size={14} className="mr-1 animate-spin" />}
                        一键检测所有连通性
                      </Button>
                      <Button
                        onClick={() => {
                          setProviderForm({ id: '', name: '', base_url: '', api_key: '', model: '', models: [] })
                          setModelsInput('')
                          setEditingProvider(null)
                          setIsProviderModalOpen(true)
                        }}
                        size="sm"
                      >
                        <Plus size={14} className="mr-1" /> 添加服务商
                      </Button>
                    </div>
                  </div>

                  {loadingConfigs ? (
                    <div className="py-10 flex justify-center">
                      <Loader2 className="animate-spin text-primary h-8 w-8" />
                    </div>
                  ) : aiProviders.length === 0 ? (
                    <div className="text-center py-12 border border-dashed border-secondary dark:border-darkBorder rounded-2xl bg-white dark:bg-darkCard">
                      <Settings className="mx-auto h-12 w-12 text-onSurface/30 dark:text-foreground/30 animate-pulse" />
                      <h3 className="mt-4 text-sm font-bold text-onSurface dark:text-foreground">暂无配置自定义 AI 服务商</h3>
                      <p className="mt-1 text-xs text-onSurface/65 dark:text-foreground/65">
                        点击右上角“添加服务商”按钮开始配置大模型。
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {aiProviders.map((provider) => {
                        const tr = testResult[provider.id]
                        const isTesting = testingProviderId === provider.id
                        const isFetching = fetchingModelsId === provider.id
                        const models = fetchedModels[provider.id] || []

                        return (
                          <div
                            key={provider.id}
                            className="p-6 rounded-3xl border border-secondary dark:border-darkBorder bg-white dark:bg-darkCard flex flex-col justify-between gap-4 shadow-sm hover:shadow-md transition-all duration-300 relative group overflow-hidden"
                          >
                            <div className="space-y-3">
                              <div className="flex justify-between items-start">
                                <div className="space-y-0.5">
                                  <h4 className="font-bold text-base text-onSurface dark:text-foreground flex items-center gap-2">
                                    {provider.name}
                                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-primary/10 text-primary uppercase">
                                      {provider.id}
                                    </span>
                                    {provider.is_reachable !== undefined && (
                                      <span
                                        className={`inline-block w-2 h-2 rounded-full ${
                                          provider.is_reachable ? 'bg-emerald-500' : 'bg-red-500'
                                        }`}
                                        title={provider.is_reachable ? `已连通 (${provider.last_checked ? new Date(provider.last_checked).toLocaleString() : '刚刚'})` : '未连通'}
                                      />
                                    )}
                                  </h4>
                                  <p className="text-[11px] font-mono text-onSurface/50 dark:text-foreground/50 truncate max-w-[280px]">
                                    {provider.base_url || 'https://api.openai.com/v1 (默认)'}
                                  </p>
                                </div>
                                <div className="flex items-center gap-1.5 opacity-60 group-hover:opacity-100 transition-opacity">
                                  <button
                                    onClick={() => {
                                      setProviderForm({ ...provider })
                                      setEditingProvider(provider)
                                      setIsProviderModalOpen(true)
                                    }}
                                    className="p-1.5 bg-secondary/50 dark:bg-darkBorder hover:bg-primary/10 hover:text-primary text-onSurface/75 dark:text-foreground/75 rounded-lg transition-colors"
                                    title="修改服务商"
                                  >
                                    <Edit size={12} />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteProvider(provider.id)}
                                    className="p-1.5 bg-red-50 dark:bg-red-500/10 hover:bg-red-500 hover:text-white text-red-500 rounded-lg transition-colors"
                                    title="删除服务商"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              </div>

                              <div className="space-y-2 text-xs">
                                <div className="flex justify-between items-center text-onSurface/70 dark:text-foreground/70 border-b border-secondary/40 dark:border-darkBorder/40 pb-1.5">
                                  <span>API Key:</span>
                                  <span className="font-mono text-onSurface dark:text-foreground">
                                    {provider.api_key ? (provider.api_key.includes('****') ? provider.api_key : '已加密保护') : '未设置'}
                                  </span>
                                </div>

                                <div className="flex flex-col gap-1.5 pt-1.5">
                                  <div className="flex justify-between items-center text-onSurface/70 dark:text-foreground/70">
                                    <span>默认模型:</span>
                                    <span className="font-bold text-primary font-mono">{provider.model || '未选择'}</span>
                                  </div>
                                  <div className="space-y-1">
                                    <span className="text-[10px] text-onSurface/50 dark:text-foreground/50">支持模型列表 ({provider.models?.length || 0}):</span>
                                    <div className="flex flex-wrap gap-1 mt-1 max-h-24 overflow-y-auto pr-1">
                                      {provider.models && provider.models.length > 0 ? (
                                        provider.models.map((m) => (
                                          <span
                                            key={m}
                                            className={`text-[10px] px-1.5 py-0.5 rounded-md font-mono transition-colors border ${
                                              m === provider.model
                                                ? 'bg-primary/20 border-primary/30 text-primary font-bold'
                                                : 'bg-secondary/40 dark:bg-darkBorder/40 border-secondary/60 dark:border-darkBorder/60 text-onSurface/70 dark:text-foreground/70'
                                            }`}
                                          >
                                            {m}
                                          </span>
                                        ))
                                      ) : (
                                        <span className="text-[10px] text-amber-500 italic">暂无模型列表，请获取或检测</span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="pt-2 border-t border-secondary/40 dark:border-darkBorder/40 flex flex-col gap-2">
                              <div className="flex gap-2 w-full">
                                <button
                                  onClick={() => handleTestConnection(provider)}
                                  disabled={isTesting}
                                  className="flex-1 py-1.5 text-xs font-semibold rounded-xl bg-secondary/50 dark:bg-darkBorder hover:bg-primary/10 hover:text-primary transition-colors text-onSurface/80 dark:text-foreground/80 flex items-center justify-center gap-1"
                                >
                                  {isTesting && <Loader2 size={12} className="animate-spin" />}
                                  <span>测试连接</span>
                                </button>
                                <button
                                  onClick={() => handleFetchModels(provider)}
                                  disabled={isFetching}
                                  className="flex-1 py-1.5 text-xs font-semibold rounded-xl bg-secondary/50 dark:bg-darkBorder hover:bg-primary/10 hover:text-primary transition-colors text-onSurface/80 dark:text-foreground/80 flex items-center justify-center gap-1"
                                >
                                  {isFetching && <Loader2 size={12} className="animate-spin" />}
                                  <span>获取模型列表</span>
                                </button>
                              </div>

                              {tr && (
                                <div
                                  className={`p-2 rounded-xl border text-[11px] leading-snug animate-fade-in ${
                                    tr.status === 'success'
                                      ? 'bg-green-500/10 border-green-500/20 text-green-600 dark:text-green-400'
                                      : 'bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400'
                                  }`}
                                >
                                  {tr.message}
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* AI Provider Edit Modal */}
                {isProviderModalOpen && (
                  <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-darkCard w-full max-w-md rounded-3xl border border-secondary dark:border-darkBorder shadow-2xl p-6 space-y-6 animate-zoom-in">
                      <div className="flex justify-between items-center border-b border-secondary/40 dark:border-darkBorder/40 pb-3">
                        <h3 className="text-lg font-bold text-onSurface dark:text-foreground">
                          {editingProvider ? '编辑 AI 服务商' : '添加 AI 服务商'}
                        </h3>
                        <button
                          onClick={() => {
                            setIsProviderModalOpen(false)
                            setEditingProvider(null)
                          }}
                          className="text-onSurface/40 hover:text-primary transition-colors font-bold text-sm"
                        >
                          ✕
                        </button>
                      </div>

                      <div className="space-y-4 text-xs">
                        <div className="space-y-1">
                          <label className="block font-semibold text-onSurface/70 dark:text-foreground/70">
                            服务商标识 (ID / 仅限小写英文字母) *
                          </label>
                          <input
                            type="text"
                            value={providerForm.id}
                            onChange={(e) => setProviderForm(prev => ({ ...prev, id: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '') }))}
                            disabled={!!editingProvider}
                            placeholder="例如: openai, deepseek, qwen"
                            className="w-full px-3 py-2 rounded-xl border border-secondary dark:border-darkBorder bg-surface dark:bg-darkBg text-onSurface dark:text-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50 font-mono"
                            required
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="block font-semibold text-onSurface/70 dark:text-foreground/70">
                            服务商显示名称 *
                          </label>
                          <input
                            type="text"
                            value={providerForm.name}
                            onChange={(e) => setProviderForm(prev => ({ ...prev, name: e.target.value }))}
                            placeholder="例如: OpenAI 官方"
                            className="w-full px-3 py-2 rounded-xl border border-secondary dark:border-darkBorder bg-surface dark:bg-darkBg text-onSurface dark:text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                            required
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="block font-semibold text-onSurface/70 dark:text-foreground/70">
                            API 基础地址 (Base URL / 留空则使用默认)
                          </label>
                          <input
                            type="text"
                            value={providerForm.base_url}
                            onChange={(e) => setProviderForm(prev => ({ ...prev, base_url: e.target.value }))}
                            placeholder="例如: https://api.deepseek.com"
                            className="w-full px-3 py-2 rounded-xl border border-secondary dark:border-darkBorder bg-surface dark:bg-darkBg text-onSurface dark:text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="block font-semibold text-onSurface/70 dark:text-foreground/70">
                            API Key * {editingProvider && "(填入以覆盖旧值，星号占位表示不修改)"}
                          </label>
                          <input
                            type="password"
                            value={providerForm.api_key}
                            onChange={(e) => setProviderForm(prev => ({ ...prev, api_key: e.target.value }))}
                            placeholder="请输入 API 密钥"
                            className="w-full px-3 py-2 rounded-xl border border-secondary dark:border-darkBorder bg-surface dark:bg-darkBg text-onSurface dark:text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                            required
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="block font-semibold text-onSurface/70 dark:text-foreground/70">
                            默认模型
                          </label>
                          <input
                            type="text"
                            value={providerForm.model}
                            onChange={(e) => setProviderForm(prev => ({ ...prev, model: e.target.value }))}
                            placeholder="例如: gpt-4o"
                            className="w-full px-3 py-2 rounded-xl border border-secondary dark:border-darkBorder bg-surface dark:bg-darkBg text-onSurface dark:text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                          />
                        </div>

                        <div className="space-y-1">
                          <div className="flex justify-between items-center">
                            <label className="block font-semibold text-onSurface/70 dark:text-foreground/70">
                              支持模型列表 (逗号分隔)
                            </label>
                            <button
                              type="button"
                              onClick={handleFetchModelsForForm}
                              disabled={fetchingModelsId === (providerForm.id || 'temp')}
                              className="text-[10px] font-semibold text-primary hover:underline flex items-center gap-0.5 disabled:opacity-50"
                            >
                              {fetchingModelsId === (providerForm.id || 'temp') && <Loader2 size={10} className="animate-spin" />}
                              自动从 API 获取列表
                            </button>
                          </div>
                          <textarea
                            value={modelsInput}
                            onChange={(e) => setModelsInput(e.target.value)}
                            placeholder="例如: gpt-4o, gpt-3.5-turbo (或者点击上方自动获取)"
                            className="w-full px-3 py-2 rounded-xl border border-secondary dark:border-darkBorder bg-surface dark:bg-darkBg text-onSurface dark:text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-mono h-20 resize-none"
                          />
                        </div>
                      </div>

                      <div className="flex justify-end gap-3 pt-2">
                        <Button
                          onClick={() => {
                            setIsProviderModalOpen(false)
                            setEditingProvider(null)
                          }}
                          variant="ghost"
                          size="sm"
                        >
                          取消
                        </Button>
                        <Button
                          onClick={() => {
                            if (!providerForm.id || !providerForm.name || !providerForm.api_key) {
                              alert('标识、名称和 API Key 不能为空！')
                              return
                            }
                            const modelsArr = modelsInput
                              .split(',')
                              .map(m => m.trim())
                              .filter(m => m.length > 0)
                            
                            let defaultModel = providerForm.model ? providerForm.model.trim() : ''
                            if (!defaultModel && modelsArr.length > 0) {
                              defaultModel = modelsArr[0]
                            }
                            
                            handleAddOrEditProvider({
                              ...providerForm,
                              models: modelsArr,
                              model: defaultModel
                            })
                          }}
                          size="sm"
                        >
                          保存服务商
                        </Button>
                      </div>
                    </div>
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
                    <h2 className="text-xl font-bold text-onSurface dark:text-foreground">网站注册邀请码中心</h2>
                  </div>

                  {/* Create code widget */}
                  <div className="p-6 rounded-2xl border border-secondary dark:border-darkBorder bg-white dark:bg-darkCard max-w-xl space-y-4 shadow-sm">
                    <h3 className="font-bold text-sm text-onSurface dark:text-foreground flex items-center gap-1">
                      <Key size={16} className="text-primary" /> 生成单次网站注册邀请码
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
                                    onClick={() => handleCopyInviteCode(codeObj.code)}
                                    className="ml-2 text-onSurface/40 hover:text-primary transition-colors"
                                    title="复制邀请激活文本"
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
