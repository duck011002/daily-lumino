'use client'

import React from 'react'
import ReactMarkdown from 'react-markdown'

export interface Message {
  id: number | string
  role: 'user' | 'assistant' | 'system'
  content: string
  attachments?: any
  created_at?: string
}

interface MessageBubbleProps {
  message: Message
}

export default function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user'

  // Extract attachment URLs if any
  let imageUrls: string[] = []
  if (message.attachments) {
    if (Array.isArray(message.attachments)) {
      imageUrls = message.attachments
    } else if (typeof message.attachments === 'string') {
      try {
        const parsed = JSON.parse(message.attachments)
        imageUrls = Array.isArray(parsed) ? parsed : []
      } catch {
        imageUrls = []
      }
    }
  }

  return (
    <div className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'} mb-4 animate-fade-in`}>
      <div className={`flex items-start max-w-[85%] sm:max-w-[75%] ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
        {/* Avatar */}
        <div
          className={`flex-shrink-0 h-9 w-9 rounded-full flex items-center justify-center text-sm font-semibold select-none shadow-sm ${
            isUser
              ? 'ml-3 bg-primary text-white'
              : 'mr-3 bg-secondary dark:bg-darkBorder text-primary border border-secondary dark:border-darkBorder'
          }`}
        >
          {isUser ? '我' : 'AI'}
        </div>

        {/* Content Bubble */}
        <div className="flex flex-col space-y-1">
          <div
            className={`px-4 py-3 rounded-2xl shadow-sm text-sm leading-relaxed transition-colors duration-300 ${
              isUser
                ? 'bg-primary text-white rounded-tr-none'
                : 'bg-white dark:bg-darkCard text-onSurface dark:text-foreground rounded-tl-none border border-secondary dark:border-darkBorder'
            }`}
          >
            {isUser ? (
              <p className="whitespace-pre-wrap break-words">{message.content}</p>
            ) : (
              <div className="prose dark:prose-invert max-w-none text-sm break-words prose-p:leading-relaxed prose-pre:bg-darkBg prose-pre:text-foreground prose-pre:p-3 prose-pre:rounded-lg">
                <ReactMarkdown>{message.content}</ReactMarkdown>
              </div>
            )}

            {/* Display uploaded images inside the bubble */}
            {imageUrls.length > 0 && (
              <div className="mt-3 grid grid-cols-1 gap-2">
                {imageUrls.map((url, idx) => (
                  <div key={idx} className="relative rounded-lg overflow-hidden border border-outline/30 bg-black/5 max-h-60 flex justify-center items-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt="上传图片"
                      className="max-h-60 max-w-full object-contain hover:scale-105 transition-transform duration-200"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
          <span
            className={`text-[10px] text-onSurface/40 dark:text-foreground/40 ${
              isUser ? 'text-right mr-1' : 'text-left ml-1'
            }`}
          >
            {message.created_at ? new Date(message.created_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : ''}
          </span>
        </div>
      </div>
    </div>
  )
}
