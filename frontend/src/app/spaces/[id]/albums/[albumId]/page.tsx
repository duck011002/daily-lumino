'use client'

import React, { useEffect, useState, useRef } from 'react'
import { useParams } from 'next/navigation'
import { Loader2, Upload, Settings } from 'lucide-react'
import api from '@/lib/api'
import Button from '@/components/ui/Button'
import ThemeToggle from '@/components/layout/ThemeToggle'
import BackLink from '@/components/ui/BackLink'
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

interface UploadProgress {
  total: number
  completed: number
  succeeded: number
  failed: number
}

const MAX_BATCH_FILES = 20
const UPLOAD_CONCURRENCY = 3

export default function AlbumDetailPage() {
  const params = useParams()
  const spaceId = params.id as string
  const albumId = params.albumId as string

  const [album, setAlbum] = useState<Album | null>(null)
  const [photos, setPhotos] = useState<Photo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null)
  const [uploadMessage, setUploadMessage] = useState('')

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
    const selectedFiles = Array.from(e.target.files || [])
    if (selectedFiles.length === 0) return

    const files = selectedFiles.slice(0, MAX_BATCH_FILES)
    const limitNotice = selectedFiles.length > MAX_BATCH_FILES
      ? `单次最多上传 ${MAX_BATCH_FILES} 张，已选择前 ${MAX_BATCH_FILES} 张。`
      : ''
    const uploadedByIndex: Array<Photo | undefined> = new Array(files.length)
    const failedNames: string[] = []
    let nextIndex = 0

    setUploading(true)
    setUploadMessage(limitNotice)
    setUploadProgress({ total: files.length, completed: 0, succeeded: 0, failed: 0 })

    const markCompleted = (succeeded: boolean) => {
      setUploadProgress((current) => current ? {
        ...current,
        completed: current.completed + 1,
        succeeded: current.succeeded + (succeeded ? 1 : 0),
        failed: current.failed + (succeeded ? 0 : 1),
      } : current)
    }

    const worker = async () => {
      while (nextIndex < files.length) {
        const index = nextIndex
        nextIndex += 1
        const file = files[index]
        const formData = new FormData()
        formData.append('file', file)

        try {
          const response = await api.post(`/spaces/${spaceId}/albums/${albumId}/photos`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
          })
          uploadedByIndex[index] = response.data
          markCompleted(true)
        } catch {
          failedNames.push(file.name)
          markCompleted(false)
        }
      }
    }

    try {
      await Promise.all(
        Array.from({ length: Math.min(UPLOAD_CONCURRENCY, files.length) }, () => worker())
      )

      const uploaded = uploadedByIndex.filter((photo): photo is Photo => Boolean(photo))
      if (uploaded.length > 0) {
        setPhotos((current) => [...uploaded, ...current])
        setAlbum((current) => current && !current.cover_url
          ? { ...current, cover_url: uploaded[0].url }
          : current
        )
      }

      if (failedNames.length > 0) {
        const preview = failedNames.slice(0, 3).join('、')
        const remaining = failedNames.length > 3 ? `等 ${failedNames.length} 个文件` : ''
        setUploadMessage(`${limitNotice}${limitNotice ? ' ' : ''}成功 ${uploaded.length} 张，失败 ${failedNames.length} 张：${preview}${remaining}`)
      } else {
        setUploadMessage(`${limitNotice}${limitNotice ? ' ' : ''}已成功上传 ${uploaded.length} 张照片。`)
      }
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
        <BackLink href={`/spaces/${spaceId}/albums`} label="返回相册列表" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface dark:bg-darkBg transition-colors duration-300">
      {/* Header */}
      <header className="w-full border-b border-secondary dark:border-darkBorder bg-white/50 dark:bg-darkCard/50 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3 w-1/2">
            <BackLink href={`/spaces/${spaceId}/albums`} label="返回相册列表" />
            
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
              multiple
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
              <Upload size={16} className="mr-1" /> 批量上传
            </Button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {(uploadProgress || uploadMessage) && (
          <div className="mb-6 rounded-xl border border-secondary bg-white p-4 text-sm shadow-sm dark:border-darkBorder dark:bg-darkCard">
            {uploadProgress && (
              <>
                <div className="mb-2 flex items-center justify-between text-onSurface/70 dark:text-foreground/70">
                  <span>{uploading ? '正在并发上传' : '本次上传完成'} {uploadProgress.completed}/{uploadProgress.total}</span>
                  <span>成功 {uploadProgress.succeeded} · 失败 {uploadProgress.failed}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-secondary/60 dark:bg-darkBorder">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-300"
                    style={{ width: `${(uploadProgress.completed / uploadProgress.total) * 100}%` }}
                  />
                </div>
              </>
            )}
            {uploadMessage && (
              <p className={`${uploadProgress ? 'mt-3' : ''} text-onSurface/70 dark:text-foreground/70`}>
                {uploadMessage}
              </p>
            )}
          </div>
        )}
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
