'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  FolderHeart, Plus, Users, Heart, Home as HomeIcon,
  Loader2, Trash2, Settings, ArrowLeft,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import api from '@/lib/api'
import Button from '@/components/ui/Button'
import ThemeToggle from '@/components/layout/ThemeToggle'

interface SpaceSummary {
  id: number
  name: string
  type: 'couple' | 'family' | 'friends'
  description: string | null
  cover_url: string | null
  member_count: number
  created_at: string
}

const TYPE_LABELS: Record<string, string> = {
  couple: '情侣空间',
  family: '家庭空间',
  friends: '挚友空间',
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  couple: <Heart size={20} />,
  family: <HomeIcon size={20} />,
  friends: <Users size={20} />,
}

const TYPE_COLORS: Record<string, string> = {
  couple: 'bg-rose-500/10 text-rose-500 border-rose-500/20',
  family: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  friends: 'bg-sky-500/10 text-sky-500 border-sky-500/20',
}

export default function SpacesPage() {
  const { user } = useAuth()
  const router = useRouter()
  const canCreate = user?.is_root || user?.can_create_spaces
  const [spaces, setSpaces] = useState<SpaceSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [showJoin, setShowJoin] = useState(false)

  // Create form
  const [createName, setCreateName] = useState('')
  const [createType, setCreateType] = useState<'couple' | 'family' | 'friends'>('couple')
  const [createDesc, setCreateDesc] = useState('')
  const [creating, setCreating] = useState(false)

  // Join form
  const [joinCode, setJoinCode] = useState('')
  const [joining, setJoining] = useState(false)
  const [joinError, setJoinError] = useState('')

  const fetchSpaces = async () => {
    try {
      const res = await api.get('/spaces')
      setSpaces(res.data)
    } catch (err) {
      console.error('获取空间列表失败', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSpaces()
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const code = params.get('invite')
      if (code) {
        setJoinCode(code)
        setShowJoin(true)
        setShowCreate(false)
      }
    }
  }, [])

  const handleCreate = async () => {
    if (!createName.trim()) return
    setCreating(true)
    try {
      const res = await api.post('/spaces', {
        name: createName,
        type: createType,
        description: createDesc || null,
      })
      setSpaces((prev) => [res.data, ...prev])
      setShowCreate(false)
      setCreateName('')
      setCreateDesc('')
      router.push(`/spaces/${res.data.id}`)
    } catch (err: any) {
      alert(err.response?.data?.detail || '创建空间失败')
    } finally {
      setCreating(false)
    }
  }

  const handleJoin = async () => {
    if (!joinCode.trim()) return
    setJoining(true)
    setJoinError('')
    try {
      const res = await api.post('/spaces/join', { code: joinCode })
      setSpaces((prev) => [res.data, ...prev])
      setShowJoin(false)
      setJoinCode('')
      router.push(`/spaces/${res.data.id}`)
    } catch (err: any) {
      setJoinError(err.response?.data?.detail || '加入失败')
    } finally {
      setJoining(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-surface dark:bg-darkBg flex items-center justify-center transition-colors duration-300">
        <Loader2 className="animate-spin text-primary h-8 w-8" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface dark:bg-darkBg transition-colors duration-300">
      {/* Header */}
      <header className="w-full border-b border-secondary dark:border-darkBorder bg-white/50 dark:bg-darkCard/50 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Link href="/dashboard" className="text-primary hover:text-primary/80 transition-colors">
              <ArrowLeft size={20} />
            </Link>
            <FolderHeart className="h-6 w-6 text-primary" />
            <h1 className="text-lg font-bold text-onSurface dark:text-foreground">我的私密空间</h1>
          </div>
          <div className="flex items-center space-x-3">
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10 space-y-8">
        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3">
          <div className="relative group inline-block">
            <Button
              onClick={() => {
                if (canCreate) {
                  setShowCreate(true)
                  setShowJoin(false)
                }
              }}
              disabled={!canCreate}
              className={`shadow-sm ${!canCreate ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <Plus size={16} className="mr-2" />
              创建空间
            </Button>
            {!canCreate && (
              <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 hidden group-hover:block w-48 bg-white dark:bg-darkCard text-onSurface dark:text-foreground text-xs p-2.5 rounded-xl shadow-lg border border-secondary dark:border-darkBorder text-center z-10 font-normal">
                您当前没有创建空间的权限，请联系管理员开通。
              </div>
            )}
          </div>
          <Button variant="outline" onClick={() => { setShowJoin(true); setShowCreate(false) }}>
            <Users size={16} className="mr-2" />
            使用邀请码加入
          </Button>
        </div>

        {/* Create Space Form */}
        {showCreate && (
          <div className="p-6 rounded-2xl border border-secondary dark:border-darkBorder bg-white dark:bg-darkCard shadow-sm animate-fade-in space-y-4">
            <h3 className="text-lg font-bold text-onSurface dark:text-foreground">创建新空间</h3>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="空间名称"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                className="w-full rounded-xl border border-secondary dark:border-darkBorder bg-surface dark:bg-darkBg px-4 py-2.5 text-sm text-onSurface dark:text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
              <div className="flex flex-wrap gap-2">
                {(['couple', 'family', 'friends'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setCreateType(t)}
                    className={`flex items-center space-x-1.5 px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
                      createType === t
                        ? TYPE_COLORS[t] + ' ring-1 ring-current'
                        : 'border-secondary dark:border-darkBorder text-onSurface/60 dark:text-foreground/60 hover:bg-surface-variant'
                    }`}
                  >
                    {TYPE_ICONS[t]}
                    <span>{TYPE_LABELS[t]}</span>
                  </button>
                ))}
              </div>
              <textarea
                placeholder="描述（选填）"
                value={createDesc}
                onChange={(e) => setCreateDesc(e.target.value)}
                rows={2}
                className="w-full rounded-xl border border-secondary dark:border-darkBorder bg-surface dark:bg-darkBg px-4 py-2.5 text-sm text-onSurface dark:text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 resize-none"
              />
              <div className="flex gap-2">
                <Button onClick={handleCreate} isLoading={creating} disabled={!createName.trim()}>
                  确认创建
                </Button>
                <Button variant="ghost" onClick={() => setShowCreate(false)}>取消</Button>
              </div>
            </div>
          </div>
        )}

        {/* Join Space Form */}
        {showJoin && (
          <div className="p-6 rounded-2xl border border-secondary dark:border-darkBorder bg-white dark:bg-darkCard shadow-sm animate-fade-in space-y-4">
            <h3 className="text-lg font-bold text-onSurface dark:text-foreground">使用邀请码加入空间</h3>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="请输入邀请码"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                className="w-full rounded-xl border border-secondary dark:border-darkBorder bg-surface dark:bg-darkBg px-4 py-2.5 text-sm text-onSurface dark:text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 font-mono"
              />
              {joinError && (
                <p className="text-xs text-red-500 font-medium">{joinError}</p>
              )}
              <div className="flex gap-2">
                <Button onClick={handleJoin} isLoading={joining} disabled={!joinCode.trim()}>
                  加入空间
                </Button>
                <Button variant="ghost" onClick={() => { setShowJoin(false); setJoinError('') }}>取消</Button>
              </div>
            </div>
          </div>
        )}

        {/* Spaces Grid */}
        {spaces.length === 0 ? (
          <div className="text-center py-20 space-y-4">
            <div className="inline-flex h-16 w-16 rounded-3xl bg-primary/10 text-primary items-center justify-center font-bold text-2xl select-none">
              🏠
            </div>
            <h3 className="text-xl font-bold text-onSurface dark:text-foreground">还没有私密空间</h3>
            <p className="text-sm text-onSurface/60 dark:text-foreground/60 max-w-sm mx-auto">
              创建一个新的空间或使用邀请码加入已有空间，开始记录专属于你们的私密生活。
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {spaces.map((space) => (
              <Link key={space.id} href={`/spaces/${space.id}`}>
                <div className="group p-6 rounded-2xl border border-secondary dark:border-darkBorder bg-white dark:bg-darkCard hover:shadow-lg transition-all duration-300 hover:translate-y-[-2px] cursor-pointer h-full flex flex-col">
                  <div className="flex items-center justify-between mb-4">
                    <div className={`h-10 w-10 rounded-xl flex items-center justify-center border ${TYPE_COLORS[space.type]}`}>
                      {TYPE_ICONS[space.type]}
                    </div>
                    <span className="text-[10px] px-2.5 py-1 rounded-full bg-secondary/50 dark:bg-darkBorder text-onSurface/60 dark:text-foreground/60 font-medium">
                      {TYPE_LABELS[space.type]}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-onSurface dark:text-foreground mb-1.5 truncate">
                    {space.name}
                  </h3>
                  {space.description && (
                    <p className="text-xs text-onSurface/55 dark:text-foreground/55 leading-relaxed line-clamp-2 mb-4 flex-1">
                      {space.description}
                    </p>
                  )}
                  <div className="flex items-center justify-between mt-auto pt-4 border-t border-secondary/50 dark:border-darkBorder/50">
                    <span className="text-xs text-onSurface/50 dark:text-foreground/50 flex items-center">
                      <Users size={12} className="mr-1" />
                      {space.member_count} 位成员
                    </span>
                    <span className="text-xs text-primary font-semibold group-hover:underline">
                      进入 →
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
