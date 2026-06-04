import React from 'react'
import { Photo } from './PhotoViewer'
import { Trash2 } from 'lucide-react'

interface PhotoGridProps {
  photos: Photo[]
  onPhotoClick: (index: number) => void
  onDelete?: (photoId: number) => void
}

export default function PhotoGrid({ photos, onPhotoClick, onDelete }: PhotoGridProps) {
  if (photos.length === 0) {
    return (
      <div className="text-center py-20">
        <p className="text-onSurface/60 dark:text-foreground/60">相册里还没有照片，快上传一张吧！</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
      {photos.map((photo, index) => (
        <div
          key={photo.id}
          className="relative group aspect-square rounded-xl overflow-hidden cursor-pointer bg-secondary dark:bg-darkBg"
          onClick={() => onPhotoClick(index)}
        >
          <img
            src={photo.thumb_url || photo.url}
            alt={photo.caption || 'photo'}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
            loading="lazy"
          />
          
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300" />

          {onDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onDelete(photo.id)
              }}
              className="absolute top-2 right-2 p-2 bg-black/50 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/80"
              title="删除照片"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
