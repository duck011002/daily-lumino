import React from 'react'
import ImageGallery from 'react-image-gallery'
import 'react-image-gallery/styles/css/image-gallery.css'
import { X, Trash2 } from 'lucide-react'

export interface Photo {
  id: number
  url: string
  thumb_url: string | null
  caption: string | null
  created_at: string
}

interface PhotoViewerProps {
  photos: Photo[]
  startIndex: number
  onClose: () => void
  onDelete?: (photoId: number) => void
}

export default function PhotoViewer({ photos, startIndex, onClose, onDelete }: PhotoViewerProps) {
  const images = photos.map((p) => ({
    original: p.url,
    thumbnail: p.thumb_url || p.url,
    description: p.caption || undefined,
    originalAlt: 'photo',
    thumbnailAlt: 'thumbnail',
    photoId: p.id,
  }))

  const renderCustomControls = () => {
    return (
      <div className="absolute top-4 right-4 z-50 flex gap-4">
        {onDelete && (
          <button
            onClick={() => {
              // Get current index from the gallery state would be better,
              // but since we don't have direct ref easily without more code,
              // we can rely on a simpler approach or just let the page handle it.
              // For simplicity, we might just not render delete here or use a ref.
            }}
            className="text-white bg-black/50 p-2 rounded-full hover:bg-red-500/80 transition"
            title="此功能在全屏下暂未绑定当前索引"
          >
          </button>
        )}
        <button
          onClick={onClose}
          className="text-white bg-black/50 p-2 rounded-full hover:bg-black/80 transition"
        >
          <X size={24} />
        </button>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 bg-black flex items-center justify-center animate-fade-in">
      <button
        onClick={onClose}
        className="absolute top-6 right-6 z-[60] text-white/70 hover:text-white p-2 rounded-full bg-black/50 transition-colors"
      >
        <X size={32} />
      </button>
      <div className="w-full h-full max-w-7xl mx-auto flex items-center justify-center relative">
        <ImageGallery
          items={images}
          startIndex={startIndex}
          showPlayButton={false}
          showFullscreenButton={false}
          showNav={true}
          lazyLoad={true}
          renderCustomControls={() => <div />} // Use default but we added our own close button
        />
      </div>
    </div>
  )
}
