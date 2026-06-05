'use client'

import React, { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Settings, Users, Key, Database, Trash2, ShieldAlert,
  Loader2, Copy, Check, Image as ImageIcon, FileText, Plus, X
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import api from '@/lib/api'
import Button from '@/components/ui/Button'
import ThemeToggle from '@/components/layout/ThemeToggle'
import { copyText } from '@/lib/utils'

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
  const [inviteModalOpen, setInviteModalOpen] = useState(false)

  // Quota
  const [quota, setQuota] = useState<StorageQuota | null>(null)

  useEffect(() => {
    fetchSpaceDetail()
    fetchQuota()
  }, [spaceId])

  useEffect(() => {
    if (space && space.created_by === user?.id && inviteModalOpen) {
      fetchInvites()
    }
  }, [space, inviteModalOpen])

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
        expires_in_hours: createInviteHours > 0 ? createInviteHours : null,
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

  const copyToClipboard = async (text: string) => {
    const success = await copyText(text)
    if (success) {
      setCopiedCode(text)
      setTimeout(() => setCopiedCode(null), 2000)
    } else {
      alert('复制失败，请手动复制。')
    }
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
              <span>成员 ({space.member_count})</span>
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
                <div className="flex items-center justify-between border-b border-secondary dark:border-darkBorder pb-4">
                  <h2 className="text-2xl font-bold text-onSurface dark:text-foreground">
                    成员
                  </h2>
                  {isOwner && (
                    <Button onClick={() => setInviteModalOpen(true)} size="sm">
                      <Plus size={16} className="mr-1" />
                      邀请新成员
                    </Button>
                  )}
                </div>
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

      {/* 邀请新成员 Modal */}
      {inviteModalOpen && isOwner && (
        <div className="fixed inset-0 bg-black/55 dark:bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-all duration-300">
          <div className="bg-white dark:bg-darkCard border border-secondary dark:border-darkBorder rounded-3xl w-full max-w-xl shadow-2xl p-6 relative flex flex-col max-h-[90vh] animate-scale-up">
            {/* Modal Header */}
            <div className="flex items-center justify-between mb-5 flex-shrink-0">
              <div className="flex items-center space-x-2">
                <Key className="text-primary h-5 w-5" />
                <h3 className="text-xl font-bold text-onSurface dark:text-foreground">邀请新成员</h3>
              </div>
              <button
                onClick={() => setInviteModalOpen(false)}
                className="p-1.5 rounded-lg hover:bg-secondary dark:hover:bg-darkBorder transition-colors text-onSurface/60 dark:text-foreground/60"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-6 pr-1.5 scrollbar-thin">
              {/* 生成新邀请码 */}
              <div className="bg-secondary/20 dark:bg-darkBg/30 border border-secondary/60 dark:border-darkBorder/40 rounded-2xl p-4 space-y-4">
                <h4 className="text-sm font-bold text-onSurface dark:text-foreground">生成新的空间邀请码</h4>
                
                {/* 时效选择 */}
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-onSurface/70 dark:text-foreground/70">有效时长 (小时)</label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { label: '永久', value: 0 }
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setCreateInviteHours(opt.value)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                          createInviteHours === opt.value
                            ? 'bg-primary text-white border-primary shadow-sm'
                            : 'border-secondary dark:border-darkBorder text-onSurface/70 dark:text-foreground/70 hover:bg-secondary/60 dark:hover:bg-darkBorder/60'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                    <div className="flex items-center space-x-1 min-w-[120px]">
                      <input
                        type="number"
                        min="1"
                        placeholder="自定义"
                        value={createInviteHours > 0 ? createInviteHours : ''}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 0
                          setCreateInviteHours(val)
                        }}
                        className={`w-full rounded-full border bg-surface dark:bg-darkBg px-3 py-1 text-xs text-center focus:outline-none focus:ring-1 focus:ring-primary/50 ${
                          createInviteHours > 0
                            ? 'border-primary ring-1 ring-primary/50'
                            : 'border-secondary dark:border-darkBorder'
                        }`}
                      />
                      <span className="text-xs text-onSurface/60 dark:text-foreground/60 whitespace-nowrap">小时</span>
                    </div>
                  </div>
                </div>

                {/* 使用次数选择 */}
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-onSurface/70 dark:text-foreground/70">最大使用次数</label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { label: '1次', value: 1 },
                      { label: '5次', value: 5 },
                      { label: '10次', value: 10 },
                      { label: '50次', value: 50 }
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setCreateInviteUses(opt.value)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                          createInviteUses === opt.value
                            ? 'bg-primary text-white border-primary shadow-sm'
                            : 'border-secondary dark:border-darkBorder text-onSurface/70 dark:text-foreground/70 hover:bg-secondary/60 dark:hover:bg-darkBorder/60'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                    <div className="flex items-center space-x-1 min-w-[120px]">
                      <input
                        type="number"
                        min="1"
                        placeholder="自定义"
                        value={![1, 5, 10, 50].includes(createInviteUses) ? createInviteUses : ''}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 1
                          setCreateInviteUses(val)
                        }}
                        className="w-full rounded-full border border-secondary dark:border-darkBorder bg-surface dark:bg-darkBg px-3 py-1 text-xs text-center focus:outline-none focus:ring-1 focus:ring-primary/50"
                      />
                      <span className="text-xs text-onSurface/60 dark:text-foreground/60 whitespace-nowrap">次</span>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <Button
                    onClick={handleCreateInvite}
                    isLoading={creatingInvite}
                    size="sm"
                    className="w-full sm:w-auto"
                  >
                    生成空间邀请码
                  </Button>
                </div>
              </div>

              {/* 已有邀请码 */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <h4 className="text-sm font-bold text-onSurface dark:text-foreground">现有空间邀请码</h4>
                  <span className="text-xs text-onSurface/60 dark:text-foreground/60">共 {invites.length} 个</span>
                </div>

                {invites.length === 0 ? (
                  <div className="text-center py-8 border border-dashed border-secondary dark:border-darkBorder rounded-2xl text-xs text-onSurface/50 dark:text-foreground/50">
                    暂无有效的空间邀请码，请在上方生成一个。
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                    {invites.map((invite) => {
                      const isExpired = invite.expires_at && new Date(invite.expires_at).getTime() <= Date.now();
                      const isUsedUp = invite.used_count >= invite.max_uses;
                      const isInvalid = isExpired || isUsedUp;
                      
                      const getExpiryLabel = (expiresAt: string | null) => {
                        if (isUsedUp) return '已满额'
                        if (!expiresAt) return '永久有效'
                        const diff = new Date(expiresAt).getTime() - Date.now()
                        if (diff <= 0) return '已过期'
                        const hours = Math.floor(diff / (1000 * 60 * 60))
                        if (hours < 1) {
                          const mins = Math.max(1, Math.floor(diff / (1000 * 60)))
                          return `${mins}分钟后过期`
                        }
                        if (hours < 24) {
                          return `${hours}小时后过期`
                        }
                        const days = Math.floor(hours / 24)
                        return `${days}天后过期`
                      }

                      const handleCopyInviteInfo = async () => {
                        const infoText = `【私密空间加入邀请】\n我邀请你加入我的私密空间「${space.name}」，快来跟我们一起分享生活吧！\n\n空间邀请码：${invite.code}\n加入方法：登录系统后，在「我的私密空间」页面选择「使用邀请码加入」，输入上方邀请码即可加入空间。\n快捷加入链接：${window.location.origin}/spaces?invite=${invite.code}`;
                        const success = await copyText(infoText);
                        if (success) {
                          setCopiedCode(invite.code);
                          setTimeout(() => setCopiedCode(null), 2000);
                        } else {
                          alert('复制失败，请手动复制。');
                        }
                      }

                      return (
                        <div
                          key={invite.id}
                          className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 transition-colors ${
                            isInvalid
                              ? 'border-secondary/40 dark:border-darkBorder/30 bg-secondary/5 dark:bg-darkBg/5 opacity-60'
                              : 'border-secondary dark:border-darkBorder bg-white dark:bg-darkCard hover:border-primary/50'
                          }`}
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-semibold select-all text-onSurface dark:text-foreground bg-secondary dark:bg-darkBg px-2 py-0.5 rounded">
                                {invite.code.slice(0, 8)}...{invite.code.slice(-4)}
                              </span>
                              {isInvalid ? (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400">
                                  {isExpired ? '已过期' : '已满额'}
                                </span>
                              ) : (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400">
                                  有效
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-x-3 text-[10px] text-onSurface/60 dark:text-foreground/60">
                              <span>使用次数：{invite.used_count} / {invite.max_uses}</span>
                              <span>·</span>
                              <span className={isExpired ? 'text-red-500' : ''}>
                                {getExpiryLabel(invite.expires_at)}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 mt-2 sm:mt-0">
                            <button
                              disabled={isInvalid}
                              onClick={handleCopyInviteInfo}
                              className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-secondary dark:border-darkBorder transition-all hover:bg-secondary/40 dark:hover:bg-darkBorder/40 ${
                                isInvalid ? 'cursor-not-allowed opacity-50' : 'text-primary'
                              }`}
                              title="复制邀请链接与信息"
                            >
                              {copiedCode === invite.code ? (
                                <>
                                  <Check size={12} />
                                  <span>已复制</span>
                                </>
                              ) : (
                                <>
                                  <Copy size={12} />
                                  <span>复制邀请信息</span>
                                </>
                              )}
                            </button>
                            <button
                              onClick={() => handleDeleteInvite(invite.id)}
                              className="px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors border border-transparent"
                            >
                              删除
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
            
            {/* Alert info */}
            <p className="mt-4 text-[10px] text-center text-onSurface/40 dark:text-foreground/40 flex-shrink-0">
              请谨慎分享空间邀请码。任何人获得此邀请码后都可以直接加入此私密空间。
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
