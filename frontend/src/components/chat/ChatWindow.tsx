'use client'

import React, { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Loader2, AlertCircle, ArrowLeft } from 'lucide-react'
import api from '@/lib/api'
import MessageBubble, { Message } from './MessageBubble'
import ChatInput from './ChatInput'

interface ChatWindowProps {
  sessionId: number
  onRefreshSessions: () => void
}

interface ChatSessionDetail {
  id: number
  title: string
  model: string
  messages: Message[]
}

interface ChatModel {
  id: string
  name: string
  model: string
  provider_id: string
  provider_name: string
  is_reachable: boolean
  is_multimodal: boolean
}

export default function ChatWindow({ sessionId, onRefreshSessions }: ChatWindowProps) {
  const [session, setSession] = useState<ChatSessionDetail | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const [availableModels, setAvailableModels] = useState<ChatModel[]>([])
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Scroll to bottom helper
  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior })
  }

  const fetchAvailableModels = async () => {
    try {
      const res = await api.get('/chat/models')
      setAvailableModels(res.data)
    } catch (err) {
      console.error('Failed to fetch available models:', err)
    }
  }

  useEffect(() => {
    fetchAvailableModels()
  }, [])

  const handleSwitchModel = async (modelId: string) => {
    if (!session) return
    setModelDropdownOpen(false)
    try {
      await api.patch(`/chat/sessions/${sessionId}`, { model: modelId })
      setSession((prev) => prev ? { ...prev, model: modelId } : null)
      onRefreshSessions()
    } catch (err: any) {
      alert('切换模型失败: ' + (err.response?.data?.detail || err.message))
    }
  }

  // Load messages on session change
  useEffect(() => {
    let active = true

    const fetchSessionDetails = async () => {
      setLoading(true)
      setError(null)
      try {
        const response = await api.get(`/chat/sessions/${sessionId}`)
        if (active) {
          setSession(response.data)
          setMessages(response.data.messages || [])
          setTimeout(() => scrollToBottom('instant'), 50)
        }
      } catch (err: any) {
        if (active) {
          setError(err.response?.data?.detail || '获取对话失败，请稍后重试。')
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    if (sessionId) {
      fetchSessionDetails()
    }

    return () => {
      active = false
    }
  }, [sessionId])

  // Scroll to bottom when messages update
  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSendMessage = async (content: string, attachments: string[] | null) => {
    if (!session) return

    // 1. Add user message locally
    const userMsg: Message = {
      id: `temp-user-${Date.now()}`,
      role: 'user',
      content,
      attachments,
      created_at: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, userMsg])
    setGenerating(true)
    setError(null)

    // 2. Add temporary placeholder assistant message
    const tempAssistantId = `temp-assistant-${Date.now()}`
    const assistantPlaceholder: Message = {
      id: tempAssistantId,
      role: 'assistant',
      content: '',
      created_at: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, assistantPlaceholder])

    try {
      // Determine request URL based on backend base URL mapping
      const baseUrl = process.env.NEXT_PUBLIC_API_BASE || '/api'
      const response = await fetch(`${baseUrl}/chat/sessions/${sessionId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Explicitly include credentials because backend stores auth cookie HTTPOnly
        },
        // Direct credentials sharing
        body: JSON.stringify({ content, attachments }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        const errorDetail = errorData.detail || '发送消息失败。'
        throw new Error(errorDetail)
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder('utf-8')
      let buffer = ''
      let fullAssistantText = ''

      if (!reader) {
        throw new Error('未获取到流读取器')
      }

      while (true) {
        const { value, done } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || '' // Keep last incomplete line

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed) continue

          if (trimmed.startsWith('data: ')) {
            const dataStr = trimmed.slice(6)
            try {
              const parsed = JSON.parse(dataStr)
              if (parsed.type === 'chunk') {
                fullAssistantText += parsed.content
                // Update message in real time
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === tempAssistantId
                      ? { ...msg, content: fullAssistantText }
                      : msg
                  )
                )
              } else if (parsed.type === 'done') {
                // Update temp id to actual database message id
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === tempAssistantId
                      ? { ...msg, id: parsed.message_id, content: fullAssistantText }
                      : msg
                  )
                )
                // Refresh sessions to update list sidebar sorting / titles
                onRefreshSessions()
              } else if (parsed.type === 'error') {
                throw new Error(parsed.content || '流式输出错误')
              }
            } catch (err: any) {
              console.error('Failed to parse line:', err, trimmed)
            }
          }
        }
      }
    } catch (err: any) {
      setError(err.message || '网络连接出错')
      // Remove placeholder if it was empty, or flag as error
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === tempAssistantId
            ? { ...msg, content: msg.content || '【流输出错误: 无法获取完整 AI 回复】' }
            : msg
        )
      )
    } finally {
      setGenerating(false)
    }
  }

  if (loading) {
    return (
      <div className="flex-1 flex flex-col justify-center items-center bg-surface dark:bg-darkBg transition-colors duration-300">
        <Loader2 className="animate-spin text-primary h-8 w-8 mb-2" />
        <p className="text-sm text-onSurface/60 dark:text-foreground/60">加载对话中...</p>
      </div>
    )
  }

  if (error && messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col justify-center items-center bg-surface dark:bg-darkBg p-6 transition-colors duration-300">
        <AlertCircle className="text-error h-10 w-10 mb-2" />
        <p className="text-sm text-error font-medium mb-4">{error}</p>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-surface dark:bg-darkBg transition-colors duration-300">
      {/* Top Header */}
      <div className="h-16 border-b border-secondary dark:border-darkBorder flex items-center justify-between px-6 bg-surface dark:bg-darkBg transition-colors duration-300 z-10">
        <div className="flex items-center space-x-3">
          <Link href="/chat" className="md:hidden text-primary hover:text-primary/80 transition-colors mr-1">
            <ArrowLeft size={18} />
          </Link>
          <h3 className="font-semibold text-onSurface dark:text-foreground text-base truncate max-w-xs md:max-w-md">
            {session?.title || '新对话'}
          </h3>
          <div className="relative">
            <button
              onClick={() => setModelDropdownOpen(!modelDropdownOpen)}
              className="text-xs px-2.5 py-1 rounded-full font-semibold bg-white dark:bg-darkCard text-onSurface dark:text-foreground border border-secondary dark:border-darkBorder hover:bg-secondary/40 dark:hover:bg-darkBorder/40 transition-all flex items-center gap-1 select-none"
            >
              <span>
                {availableModels.find((m) => m.id === session?.model)?.name || session?.model || '选择模型'}
              </span>
              <span className="text-[9px] opacity-60">▼</span>
            </button>
            
            {modelDropdownOpen && (
              <div className="absolute left-0 mt-1.5 w-64 rounded-2xl bg-white dark:bg-darkCard border border-secondary dark:border-darkBorder shadow-2xl z-30 p-1.5 space-y-0.5 max-h-80 overflow-y-auto animate-fade-in">
                {availableModels.map((m) => {
                  const isCurrent = session?.model === m.id
                  return (
                    <button
                      key={m.id}
                      disabled={!m.is_reachable}
                      onClick={() => handleSwitchModel(m.id)}
                      className={`w-full text-left px-3 py-2 rounded-xl text-xs transition-all flex items-center justify-between ${
                        isCurrent
                          ? 'bg-primary/10 text-primary font-bold'
                          : m.is_reachable
                          ? 'text-onSurface/85 dark:text-foreground/85 hover:bg-secondary/40 dark:hover:bg-darkBorder/40'
                          : 'text-onSurface/40 dark:text-foreground/45 cursor-not-allowed opacity-50'
                      }`}
                    >
                      <div className="flex flex-col min-w-0">
                        <span className="truncate font-semibold">{m.model}</span>
                        <span className="text-[10px] opacity-60 truncate">
                          {m.provider_name} {m.is_multimodal ? '(支持图片)' : '(仅文本)'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {m.is_reachable ? (
                          <span className="h-1.5 w-1.5 rounded-full bg-green-500" title="连通正常" />
                        ) : (
                          <span className="h-1.5 w-1.5 rounded-full bg-red-500" title="不可达/不可用" />
                        )}
                        {isCurrent && <span className="text-primary text-[10px]">✓</span>}
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Messages Feed Area */}
      <div className="flex-1 overflow-y-auto px-4 py-6 md:px-6">
        <div className="max-w-4xl mx-auto space-y-4">
          {messages.length === 0 ? (
            <div className="text-center py-20 space-y-3">
              <div className="inline-flex h-12 w-12 rounded-2xl bg-primary/10 text-primary items-center justify-center font-bold text-lg">
                💡
              </div>
              <h4 className="text-lg font-semibold text-onSurface dark:text-foreground">开始新的探索</h4>
              <p className="text-sm text-onSurface/55 dark:text-foreground/55 max-w-sm mx-auto">
                输入您的第一个问题，AI 助手将流式回复您。支持 markdown 渲染与代码块。
              </p>
            </div>
          ) : (
            messages.map((msg) => <MessageBubble key={msg.id} message={msg} />)
          )}
          {generating && (
            <div className="flex items-center space-x-2 text-xs text-onSurface/50 dark:text-foreground/50 ml-12 py-2">
              <Loader2 className="animate-spin h-3.5 w-3.5 text-primary" />
              <span>AI 正在思考输入...</span>
            </div>
          )}
          {error && (
            <div className="flex items-center space-x-2 text-xs text-error ml-12 py-2 bg-error/5 rounded-lg px-3 border border-error/20 max-w-fit animate-fade-in">
              <AlertCircle size={14} />
              <span>{error}</span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input controls at bottom */}
      {session && (
        <ChatInput
          onSendMessage={handleSendMessage}
          disabled={generating}
          isMultimodal={
            availableModels.find((m) => m.id === session.model)?.is_multimodal ||
            session.model.toLowerCase().includes('qwen') ||
            session.model.toLowerCase().includes('vl')
          }
        />
      )}
    </div>
  )
}
