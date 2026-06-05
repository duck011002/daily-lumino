'use client'

import React, { useRef, useState } from 'react'
import { Image as ImageIcon, Paperclip, Send, X } from 'lucide-react'
import Button from '@/components/ui/Button'

interface ChatInputProps {
  onSendMessage: (content: string, attachments: string[] | null) => void
  disabled: boolean
  isMultimodal: boolean
}

export default function ChatInput({ onSendMessage, disabled, isMultimodal }: ChatInputProps) {
  const [content, setContent] = useState('')
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const isDeepSeek = !isMultimodal

  const handleSend = () => {
    if (!content.trim() && !imagePreview) return
    const attachments = imagePreview ? [imagePreview] : null
    onSendMessage(content, attachments)
    setContent('')
    setImagePreview(null)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Limit to images
    if (!file.type.startsWith('image/')) {
      alert('只能上传图片文件')
      return
    }

    const reader = new FileReader()
    reader.onloadend = () => {
      setImagePreview(reader.result as string)
    }
    reader.readAsDataURL(file)

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleRemoveImage = () => {
    setImagePreview(null)
  }

  return (
    <div className="border-t border-secondary dark:border-darkBorder p-4 bg-surface dark:bg-darkBg transition-colors duration-300">
      <div className="max-w-4xl mx-auto flex flex-col space-y-3">
        {/* Image Preview Block */}
        {imagePreview && (
          <div className="relative inline-block w-20 h-20 rounded-lg overflow-hidden border border-secondary dark:border-darkBorder bg-secondary dark:bg-darkBorder group">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
            <button
              onClick={handleRemoveImage}
              className="absolute top-1 right-1 p-0.5 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* Input Bar */}
        <div className="flex items-end space-x-2">
          {/* File attachment button (only for Qwen) */}
          <input
            type="file"
            accept="image/*"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || isDeepSeek}
            title={isDeepSeek ? '当前模型仅支持文本' : '添加图片'}
            className={`p-3 rounded-xl border border-secondary dark:border-darkBorder bg-white dark:bg-darkCard text-onSurface dark:text-foreground transition-all duration-200 flex items-center justify-center ${
              isDeepSeek
                ? 'opacity-40 cursor-not-allowed'
                : 'hover:bg-primary/10 hover:border-primary/30 active:scale-95'
            }`}
          >
            <ImageIcon size={18} />
          </button>

          {/* Input text area */}
          <div className="flex-1 relative">
            <textarea
              rows={1}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                isDeepSeek
                  ? '发送消息... (当前模型仅支持文本)'
                  : '发送消息... (当前模型支持图片输入)'
              }
              disabled={disabled}
              className="w-full rounded-2xl border border-secondary dark:border-darkBorder bg-white dark:bg-darkCard text-onSurface dark:text-foreground px-4 py-3 pr-10 focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50 placeholder:text-onSurface/40 dark:placeholder:text-foreground/40 resize-none text-sm transition-all duration-300 min-h-[44px] max-h-36 overflow-y-auto"
              style={{ height: 'auto' }}
            />
          </div>

          {/* Send Button */}
          <Button
            onClick={handleSend}
            disabled={disabled || (!content.trim() && !imagePreview)}
            className="rounded-2xl p-3 h-11 w-11 flex items-center justify-center flex-shrink-0"
          >
            <Send size={16} />
          </Button>
        </div>
      </div>
    </div>
  )
}
