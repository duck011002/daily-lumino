'use client'

import React, { useContext } from 'react'
import { useParams } from 'next/navigation'
import ChatWindow from '@/components/chat/ChatWindow'
import { ChatContext } from '../layout'

export default function ChatDetailPage() {
  const params = useParams()
  const sessionId = parseInt(params.id as string, 10)
  const { refreshSessions } = useContext(ChatContext)

  if (isNaN(sessionId)) {
    return (
      <div className="h-full flex items-center justify-center bg-surface dark:bg-darkBg transition-colors duration-300">
        <p className="text-sm text-error">无效的会话 ID</p>
      </div>
    )
  }

  return (
    <ChatWindow sessionId={sessionId} onRefreshSessions={refreshSessions} />
  )
}
