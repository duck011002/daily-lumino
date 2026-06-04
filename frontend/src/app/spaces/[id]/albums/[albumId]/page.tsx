'use client'

import React, { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Loader2, Upload, Settings } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import api from '@/lib/api'
import Button from '@/components/ui/Button'
import ThemeToggle from '@/components/layout/ThemeToggle'
import PhotoGrid from '@/components/album/PhotoGrid'
import PhotoViewer, { Photo } from '@/components/album/PhotoViewer'

interface Album {
  id: number
  space_id: number
  name: string
  cover_url: string | null
  created_by: number
  created_at: string
  photo_count: number
}

export default function AlbumDetailPage() {
  const params = useParams()
  const router = useRouter()
  const spaceId = params.id as string
  const albumId = params.albumId as string
  const { user } = useAuth()

  const [album, setAlbum] = useState<Album | null>(null)
  const [photos, setPhotos] = useState<Photo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)

  // Viewer state
  const [viewerIndex, setViewerIndex] = useState<number | null>(null)

  // Rename state
  const [isRenaming, setIsRenaming] = useState(false)
  const [newName, setNewName] = useState('')
  
  const fileInputRef = useRef<HTMLInputElement>(null)

  const fetchData = async () => {
    try {
      const [albumRes, photosRes] = await Promise.all([
        api.get(`/spaces/${spaceId}/albums/${albumId}`),
        api.get(`/spaces/${spaceId}/albums/${albumId}/photos`)
      ])
      setAlbum(albumRes.data)
      setNewName(albumRes.data.name)
      setPhotos(photosRes.data)
    } catch (err: any) {
      setError(err.response?.data?.detail || '加载相册失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [spaceId, albumId])

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await api.post(`/spaces/${spaceId}/albums/${albumId}/photos`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      setPhotos([res.data, ...photos])
      
      // Update cover locally if this is the first photo
      if (photos.length === 0 && album) {
        setAlbum({ ...album, cover_url: res.data.url })
      }
    } catch (err: any) {
      alert(err.response?.data?.detail || '上传失败')
    } finally {
      setUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleDeletePhoto = async (photoId: number) => {
    if (!confirm('确定要删除这张照片吗？（配额将返还，实际文件暂不自动删除）')) return
    try {
      await api.delete(`/spaces/${spaceId}/albums/${albumId}/photos/${photoId}`)
      setPhotos(photos.filter(p => p.id !== photoId))
    } catch (err: any) {
      alert(err.response?.data?.detail || '删除失败')
    }
  }

  const handleRename = async () => {
    if (!newName.trim() || newName === album?.name) {
      setIsRenaming(false)
      return
    }
    try {
      const res = await api.patch(`/spaces/${spaceId}/albums/${albumId}`, { name: newName })
      setAlbum(res.data)
      setIsRenaming(false)
    } catch (err: any) {
      alert(err.response?.data?.detail || '修改名称失败')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-surface dark:bg-darkBg flex items-center justify-center">
        <Loader2 className="animate-spin text-primary h-8 w-8" />
      </div>
    )
  }

  if (error || !album) {
    return (
      <div className="min-h-screen bg-surface dark:bg-darkBg flex flex-col items-center justify-center">
        <p className="text-red-500 mb-4">{error || '相册不存在'}</p>
        <Link href={`/spaces/${spaceId}/albums`}>
          <Button variant="outline">返回相册列表</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface dark:bg-darkBg transition-colors duration-300">
      {/* Header */}
      <header className="w-full border-b border-secondary dark:border-darkBorder bg-white/50 dark:bg-darkCard/50 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3 w-1/2">
            <Link href={`/spaces/${spaceId}/albums`} className="text-primary hover:text-primary/80 transition-colors">
              <ArrowLeft size={20} />
            </Link>
            
            {isRenaming ? (
              <div className="flex items-center space-x-2 w-full">
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="rounded-md border border-secondary dark:border-darkBorder bg-transparent px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary w-full max-w-[200px]"
                  autoFocus
                  onBlur={handleRename}
                  onKeyDown={(e) => e.key === 'Enter' && handleRename()}
                />
              </div>
            ) : (
              <h1 className="text-lg font-bold text-onSurface dark:text-foreground flex items-center group cursor-pointer" onClick={() => setIsRenaming(true)}>
                {album.name}
                <Settings size={14} className="ml-2 text-onSurface/40 opacity-0 group-hover:opacity-100 transition-opacity" />
              </h1>
            )}
          </div>

          <div className="flex items-center space-x-3">
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              ref={fileInputRef}
              className="hidden"
              onChange={handleUpload}
            />
            <Button 
              onClick={() => fileInputRef.current?.click()} 
              size="sm" 
              className="shadow-sm"
              isLoading={uploading}
            >
              <Upload size={16} className="mr-1" /> 上传照片
            </Button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <PhotoGrid 
          photos={photos} 
          onPhotoClick={(index) => setViewerIndex(index)}
          onDelete={handleDeletePhoto}
        />
      </main>

      {/* Photo Viewer Modal */}
      {viewerIndex !== null && (
        <PhotoViewer
          photos={photos}
          startIndex={viewerIndex}
          onClose={() => setViewerIndex(null)}
        />
      )}
    </div>
  )
}
