'use client'

import React, { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Settings, Users, Key, Database, Trash2, ShieldAlert,
  Loader2, Copy, Check, Image as ImageIcon, FileText
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import api from '@/lib/api'
import Button from '@/components/ui/Button'
import ThemeToggle from '@/components/layout/ThemeToggle'

interface SpaceMember {
  id: number
  user_id: number
  username: string
  display_name: string | null
  avatar_url: string | null
  role: 'owner' | 'member'
  joined_at: string
}

interface SpaceDetail {
  id: number
  name: string
  type: string
  description: string | null
  cover_url: string | null
  created_by: number
  created_at: string
  member_count: number
  members: SpaceMember[]
}

interface InviteCode {
  id: number
  code: string
  max_uses: number
  used_count: number
  expires_at: string | null
  created_at: string
}

interface StorageQuota {
  max_size_mb: number
  used_size_mb: number
  remaining_mb: number
  usage_percent: number
}

export default function SpaceDetailPage() {
  const params = useParams()
  const router = useRouter()
  const spaceId = params.id as string
  const { user } = useAuth()

  const [space, setSpace] = useState<SpaceDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'members' | 'settings'>('members')
  const [error, setError] = useState('')

  // Settings
  const [editName, setEditName] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [saving, setSaving] = useState(false)

  // Invites
  const [invites, setInvites] = useState<InviteCode[]>([])
  const [createInviteUses, setCreateInviteUses] = useState(1)
  const [createInviteHours, setCreateInviteHours] = useState(24)
  const [creatingInvite, setCreatingInvite] = useState(false)
  const [copiedCode, setCopiedCode] = useState<string | null>(null)

  // Quota
  const [quota, setQuota] = useState<StorageQuota | null>(null)

  useEffect(() => {
    fetchSpaceDetail()
    fetchQuota()
  }, [spaceId])

  useEffect(() => {
    if (space && space.created_by === user?.id && activeTab === 'settings') {
      fetchInvites()
    }
  }, [space, activeTab])

  const fetchSpaceDetail = async () => {
    try {
      const res = await api.get(`/spaces/${spaceId}`)
      setSpace(res.data)
      setEditName(res.data.name)
      setEditDesc(res.data.description || '')
    } catch (err: any) {
      setError(err.response?.data?.detail || '加载空间详情失败')
    } finally {
      setLoading(false)
    }
  }

  const fetchInvites = async () => {
    try {
      const res = await api.get(`/spaces/${spaceId}/invites`)
      setInvites(res.data)
    } catch (err) {
      console.error('获取邀请码失败', err)
    }
  }

  const fetchQuota = async () => {
    try {
      const res = await api.get('/spaces/storage/quota')
      setQuota(res.data)
    } catch (err) {
      console.error('获取存储配额失败', err)
    }
  }

  const handleUpdateSpace = async () => {
    if (!editName.trim()) return
    setSaving(true)
    try {
      const res = await api.patch(`/spaces/${spaceId}`, {
        name: editName,
        description: editDesc || null,
      })
      setSpace((prev) => prev ? { ...prev, ...res.data } : null)
      alert('保存成功')
    } catch (err: any) {
      alert(err.response?.data?.detail || '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteSpace = async () => {
    if (!confirm('确定要删除这个空间吗？此操作不可恢复！')) return
    try {
      await api.delete(`/spaces/${spaceId}`)
      router.push('/spaces')
    } catch (err: any) {
      alert(err.response?.data?.detail || '删除失败')
    }
  }

  const handleCreateInvite = async () => {
    setCreatingInvite(true)
    try {
      await api.post(`/spaces/${spaceId}/invites`, {
        expires_in_hours: createInviteHours,
        max_uses: createInviteUses,
      })
      fetchInvites()
    } catch (err: any) {
      alert(err.response?.data?.detail || '生成失败')
    } finally {
      setCreatingInvite(false)
    }
  }

  const handleDeleteInvite = async (inviteId: number) => {
    if (!confirm('确定删除此邀请码？')) return
    try {
      await api.delete(`/spaces/${spaceId}/invites/${inviteId}`)
      fetchInvites()
    } catch (err: any) {
      alert(err.response?.data?.detail || '删除失败')
    }
  }

  const handleRemoveMember = async (userId: number) => {
    if (!confirm('确定将该成员移出空间？')) return
    try {
      await api.delete(`/spaces/${spaceId}/members/${userId}`)
      fetchSpaceDetail()
    } catch (err: any) {
      alert(err.response?.data?.detail || '移除失败')
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedCode(text)
    setTimeout(() => setCopiedCode(null), 2000)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-surface dark:bg-darkBg flex items-center justify-center">
        <Loader2 className="animate-spin text-primary h-8 w-8" />
      </div>
    )
  }

  if (error || !space) {
    return (
      <div className="min-h-screen bg-surface dark:bg-darkBg flex flex-col items-center justify-center space-y-4">
        <ShieldAlert className="h-12 w-12 text-red-500" />
        <h2 className="text-xl font-bold text-onSurface dark:text-foreground">{error || '空间不存在'}</h2>
        <Link href="/spaces">
          <Button variant="outline">返回空间列表</Button>
        </Link>
      </div>
    )
  }

  const isOwner = space.created_by === user?.id

  return (
    <div className="min-h-screen bg-surface dark:bg-darkBg transition-colors duration-300">
      {/* Header */}
      <header className="w-full border-b border-secondary dark:border-darkBorder bg-white/50 dark:bg-darkCard/50 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Link href="/spaces" className="text-primary hover:text-primary/80 transition-colors">
              <ArrowLeft size={20} />
            </Link>
            <h1 className="text-lg font-bold text-onSurface dark:text-foreground">{space.name}</h1>
          </div>
          <div className="flex items-center space-x-3">
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex flex-col md:flex-row gap-8">
          {/* Sidebar */}
          <div className="w-full md:w-64 flex-shrink-0 flex flex-row md:flex-col overflow-x-auto md:overflow-x-visible pb-3 md:pb-0 gap-2 border-b border-secondary/40 md:border-b-0 dark:border-darkBorder/40 scrollbar-none">
            <button
              onClick={() => setActiveTab('members')}
              className={`flex-shrink-0 md:w-full flex items-center space-x-2 md:space-x-3 px-4 py-2.5 md:py-3 rounded-xl transition-colors text-sm md:text-base whitespace-nowrap ${
                activeTab === 'members'
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-onSurface/70 dark:text-foreground/70 hover:bg-secondary/50 dark:hover:bg-darkBorder/50'
              }`}
            >
              <Users size={18} />
              <span>成员管理 ({space.member_count})</span>
            </button>
            <Link
              href={`/spaces/${spaceId}/albums`}
              className="flex-shrink-0 md:w-full flex items-center space-x-2 md:space-x-3 px-4 py-2.5 md:py-3 rounded-xl transition-colors text-sm md:text-base whitespace-nowrap text-onSurface/70 dark:text-foreground/70 hover:bg-secondary/50 dark:hover:bg-darkBorder/50"
            >
              <ImageIcon size={18} />
              <span>空间相册</span>
            </Link>
            <Link
              href={`/spaces/${spaceId}/notes`}
              className="flex-shrink-0 md:w-full flex items-center space-x-2 md:space-x-3 px-4 py-2.5 md:py-3 rounded-xl transition-colors text-sm md:text-base whitespace-nowrap text-onSurface/70 dark:text-foreground/70 hover:bg-secondary/50 dark:hover:bg-darkBorder/50"
            >
              <FileText size={18} />
              <span>空间记录</span>
            </Link>
            {isOwner && (
              <button
                onClick={() => setActiveTab('settings')}
                className={`flex-shrink-0 md:w-full flex items-center space-x-2 md:space-x-3 px-4 py-2.5 md:py-3 rounded-xl transition-colors text-sm md:text-base whitespace-nowrap ${
                  activeTab === 'settings'
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-onSurface/70 dark:text-foreground/70 hover:bg-secondary/50 dark:hover:bg-darkBorder/50'
                }`}
              >
                <Settings size={18} />
                <span>空间设置</span>
              </button>
            )}
          </div>

          {/* Main Content */}
          <div className="flex-1 space-y-6">
            {activeTab === 'members' && (
              <div className="space-y-6 animate-fade-in">
                <h2 className="text-2xl font-bold text-onSurface dark:text-foreground border-b border-secondary dark:border-darkBorder pb-4">
                  成员管理
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {space.members.map((member) => (
                    <div
                      key={member.user_id}
                      className="p-4 rounded-xl border border-secondary dark:border-darkBorder bg-white dark:bg-darkCard flex items-center justify-between"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
                          {(member.display_name || member.username).charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-sm text-onSurface dark:text-foreground">
                            {member.display_name || member.username}
                          </p>
                          <p className="text-xs text-onSurface/60 dark:text-foreground/60">
                            {member.role === 'owner' ? '所有者' : '成员'} · {new Date(member.joined_at).toLocaleDateString()} 加入
                          </p>
                        </div>
                      </div>
                      {isOwner && member.user_id !== user?.id && (
                        <button
                          onClick={() => handleRemoveMember(member.user_id)}
                          className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
                          title="移出空间"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'settings' && isOwner && (
              <div className="space-y-8 animate-fade-in">
                <h2 className="text-2xl font-bold text-onSurface dark:text-foreground border-b border-secondary dark:border-darkBorder pb-4">
                  空间设置
                </h2>

                {/* Storage Quota */}
                {quota && (
                  <div className="p-5 rounded-xl border border-secondary dark:border-darkBorder bg-white dark:bg-darkCard space-y-3">
                    <div className="flex items-center space-x-2 text-onSurface dark:text-foreground font-medium">
                      <Database size={18} className="text-primary" />
                      <h3>存储空间使用情况</h3>
                    </div>
                    <div className="w-full bg-secondary dark:bg-darkBg rounded-full h-2.5">
                      <div
                        className="bg-primary h-2.5 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(quota.usage_percent, 100)}%` }}
                      ></div>
                    </div>
                    <div className="flex justify-between text-xs text-onSurface/60 dark:text-foreground/60">
                      <span>已使用: {quota.used_size_mb} MB ({quota.usage_percent}%)</span>
                      <span>总容量: {quota.max_size_mb} MB</span>
                    </div>
                  </div>
                )}

                {/* Basic Info */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-onSurface dark:text-foreground">基本信息</h3>
                  <div className="space-y-3 max-w-md">
                    <div>
                      <label className="block text-xs font-medium text-onSurface/70 dark:text-foreground/70 mb-1">
                        空间名称
                      </label>
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full rounded-xl border border-secondary dark:border-darkBorder bg-surface dark:bg-darkBg px-4 py-2 text-sm text-onSurface dark:text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-onSurface/70 dark:text-foreground/70 mb-1">
                        空间描述
                      </label>
                      <textarea
                        value={editDesc}
                        onChange={(e) => setEditDesc(e.target.value)}
                        rows={3}
                        className="w-full rounded-xl border border-secondary dark:border-darkBorder bg-surface dark:bg-darkBg px-4 py-2 text-sm text-onSurface dark:text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 resize-none"
                      />
                    </div>
                    <Button onClick={handleUpdateSpace} isLoading={saving} disabled={!editName.trim()}>
                      保存更改
                    </Button>
                  </div>
                </div>

                {/* Invites Management */}
                <div className="space-y-4 pt-4 border-t border-secondary dark:border-darkBorder">
                  <h3 className="text-lg font-semibold text-onSurface dark:text-foreground flex items-center">
                    <Key size={18} className="mr-2" /> 邀请码管理
                  </h3>
                  
                  <div className="flex items-end gap-3 max-w-md">
                    <div className="flex-1">
                      <label className="block text-xs font-medium text-onSurface/70 dark:text-foreground/70 mb-1">有效时长(小时)</label>
                      <input
                        type="number"
                        min="1"
                        max="720"
                        value={createInviteHours}
                        onChange={(e) => setCreateInviteHours(parseInt(e.target.value) || 24)}
                        className="w-full rounded-xl border border-secondary dark:border-darkBorder bg-surface dark:bg-darkBg px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs font-medium text-onSurface/70 dark:text-foreground/70 mb-1">使用次数</label>
                      <input
                        type="number"
                        min="1"
                        max="50"
                        value={createInviteUses}
                        onChange={(e) => setCreateInviteUses(parseInt(e.target.value) || 1)}
                        className="w-full rounded-xl border border-secondary dark:border-darkBorder bg-surface dark:bg-darkBg px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
                      />
                    </div>
                    <Button onClick={handleCreateInvite} isLoading={creatingInvite} className="mb-0.5">
                      生成邀请码
                    </Button>
                  </div>

                  {invites.length > 0 && (
                    <div className="overflow-x-auto rounded-xl border border-secondary dark:border-darkBorder">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-secondary/50 dark:bg-darkBg text-onSurface/70 dark:text-foreground/70">
                          <tr>
                            <th className="px-4 py-3 font-medium">邀请码</th>
                            <th className="px-4 py-3 font-medium">使用情况</th>
                            <th className="px-4 py-3 font-medium">过期时间</th>
                            <th className="px-4 py-3 font-medium">操作</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-secondary dark:divide-darkBorder">
                          {invites.map((invite) => (
                            <tr key={invite.id} className="bg-white dark:bg-darkCard">
                              <td className="px-4 py-3 font-mono text-primary flex items-center">
                                {invite.code.slice(0, 8)}...{invite.code.slice(-4)}
                                <button
                                  onClick={() => copyToClipboard(invite.code)}
                                  className="ml-2 text-onSurface/40 hover:text-primary transition-colors"
                                >
                                  {copiedCode === invite.code ? <Check size={14} /> : <Copy size={14} />}
                                </button>
                              </td>
                              <td className="px-4 py-3 text-onSurface dark:text-foreground">
                                {invite.used_count} / {invite.max_uses}
                              </td>
                              <td className="px-4 py-3 text-onSurface/70 dark:text-foreground/70">
                                {invite.expires_at ? new Date(invite.expires_at).toLocaleString() : '永久'}
                              </td>
                              <td className="px-4 py-3">
                                <button
                                  onClick={() => handleDeleteInvite(invite.id)}
                                  className="text-red-500 hover:text-red-600 transition-colors"
                                >
                                  删除
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Danger Zone */}
                <div className="space-y-4 pt-4 border-t border-secondary dark:border-darkBorder">
                  <h3 className="text-lg font-semibold text-red-500 flex items-center">
                    <ShieldAlert size={18} className="mr-2" /> 危险区域
                  </h3>
                  <div className="p-4 rounded-xl border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/5">
                    <h4 className="font-medium text-red-700 dark:text-red-400 mb-1">删除空间</h4>
                    <p className="text-sm text-red-600/80 dark:text-red-400/80 mb-3">
                      删除空间将永久移除其中的所有数据和成员，此操作不可撤销。
                    </p>
                    <Button variant="danger" onClick={handleDeleteSpace}>
                      删除空间
                    </Button>
                  </div>
                </div>

              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
