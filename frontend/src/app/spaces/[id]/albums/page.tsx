'use client'

import React, { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Image as ImageIcon, Plus, Loader2, ImageOff, Trash2 } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import api from '@/lib/api'
import Button from '@/components/ui/Button'
import ThemeToggle from '@/components/layout/ThemeToggle'

interface Album {
  id: number
  space_id: number
  name: string
  cover_url: string | null
  created_by: number
  created_at: string
  photo_count: number
}

export default function SpaceAlbumsPage() {
  const params = useParams()
  const router = useRouter()
  const spaceId = params.id as string
  const { user } = useAuth()

  const [albums, setAlbums] = useState<Album[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Create modal
  const [showCreate, setShowCreate] = useState(false)
  const [createName, setCreateName] = useState('')
  const [creating, setCreating] = useState(false)

  const fetchAlbums = async () => {
    try {
      const res = await api.get(`/spaces/${spaceId}/albums`)
      setAlbums(res.data)
    } catch (err: any) {
      setError(err.response?.data?.detail || '无法加载相册')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAlbums()
  }, [spaceId])

  const handleCreate = async () => {
    if (!createName.trim()) return
    setCreating(true)
    try {
      const res = await api.post(`/spaces/${spaceId}/albums`, { name: createName })
      setAlbums((prev) => [res.data, ...prev])
      setShowCreate(false)
      setCreateName('')
    } catch (err: any) {
      alert(err.response?.data?.detail || '创建相册失败')
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (e: React.MouseEvent, albumId: number) => {
    e.preventDefault()
    e.stopPropagation()
    if (!confirm('确定要删除这个相册吗？其中的所有照片记录将被删除（配额将返还）。')) return

    try {
      await api.delete(`/spaces/${spaceId}/albums/${albumId}`)
      setAlbums((prev) => prev.filter(a => a.id !== albumId))
    } catch (err: any) {
      alert(err.response?.data?.detail || '删除失败')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-surface dark:bg-darkBg flex items-center justify-center">
        <Loader2 className="animate-spin text-primary h-8 w-8" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-surface dark:bg-darkBg flex flex-col items-center justify-center">
        <p className="text-red-500 mb-4">{error}</p>
        <Link href={`/spaces/${spaceId}`}>
          <Button variant="outline">返回空间</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface dark:bg-darkBg transition-colors duration-300">
      {/* Header */}
      <header className="w-full border-b border-secondary dark:border-darkBorder bg-white/50 dark:bg-darkCard/50 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Link href={`/spaces/${spaceId}`} className="text-primary hover:text-primary/80 transition-colors">
              <ArrowLeft size={20} />
            </Link>
            <ImageIcon className="h-6 w-6 text-primary" />
            <h1 className="text-lg font-bold text-onSurface dark:text-foreground">相册集</h1>
          </div>
          <div className="flex items-center space-x-3">
            <Button onClick={() => setShowCreate(true)} size="sm" className="shadow-sm">
              <Plus size={16} className="mr-1" /> 新建相册
            </Button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Create Modal */}
        {showCreate && (
          <div className="mb-8 p-6 rounded-2xl border border-secondary dark:border-darkBorder bg-white dark:bg-darkCard shadow-sm animate-fade-in max-w-md">
            <h3 className="text-lg font-bold text-onSurface dark:text-foreground mb-4">创建新相册</h3>
            <input
              type="text"
              placeholder="相册名称"
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              className="w-full rounded-xl border border-secondary dark:border-darkBorder bg-surface dark:bg-darkBg px-4 py-2.5 text-sm mb-4 focus:outline-none focus:ring-1 focus:ring-primary/50"
            />
            <div className="flex gap-2">
              <Button onClick={handleCreate} isLoading={creating} disabled={!createName.trim()}>
                确认创建
              </Button>
              <Button variant="ghost" onClick={() => { setShowCreate(false); setCreateName('') }}>取消</Button>
            </div>
          </div>
        )}

        {/* Albums Grid */}
        {albums.length === 0 ? (
          <div className="text-center py-20 space-y-4">
            <div className="inline-flex h-16 w-16 rounded-3xl bg-primary/10 text-primary items-center justify-center font-bold">
              <ImageOff size={24} />
            </div>
            <h3 className="text-xl font-bold text-onSurface dark:text-foreground">空空如也</h3>
            <p className="text-sm text-onSurface/60 dark:text-foreground/60 max-w-sm mx-auto">
              空间里还没有任何相册，点击上方“新建相册”开始记录你们的美好瞬间吧。
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {albums.map((album) => (
              <Link key={album.id} href={`/spaces/${spaceId}/albums/${album.id}`}>
                <div className="group rounded-2xl overflow-hidden border border-secondary dark:border-darkBorder bg-white dark:bg-darkCard hover:shadow-lg transition-all duration-300 hover:translate-y-[-2px] cursor-pointer">
                  <div className="aspect-square bg-secondary dark:bg-darkBg relative group overflow-hidden">
                    {album.cover_url ? (
                      <img
                        src={album.cover_url}
                        alt={album.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-onSurface/30 dark:text-foreground/30 group-hover:text-primary/50 transition-colors">
                        <ImageOff size={32} />
                        <span className="text-xs mt-2 font-medium">无封面</span>
                      </div>
                    )}
                    
                    {/* Delete overlay button */}
                    <button
                      onClick={(e) => handleDelete(e, album.id)}
                      className="absolute top-2 right-2 p-2 bg-black/50 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/80"
                      title="删除相册"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <div className="p-4">
                    <h3 className="font-bold text-onSurface dark:text-foreground truncate mb-1">
                      {album.name}
                    </h3>
                    <p className="text-xs text-onSurface/60 dark:text-foreground/60 flex items-center justify-between">
                      <span>{album.photo_count} 张照片</span>
                      <span>{new Date(album.created_at).toLocaleDateString()}</span>
                    </p>
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
