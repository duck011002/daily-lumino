'use client'

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { MessageSquare, Plus, Trash2, Home, Edit3, Check, X, Loader2 } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import api from '@/lib/api'
import Button from '@/components/ui/Button'
import ThemeToggle from '@/components/layout/ThemeToggle'

interface Session {
  id: number
  title: string
  model: 'qwen' | 'deepseek'
  updated_at: string
}

interface ChatContextType {
  refreshSessions: () => void
}

export const ChatContext = createContext<ChatContextType>({
  refreshSessions: () => {},
})

export default function ChatLayout({ children }: { children: ReactNode }) {
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [showModelSelect, setShowModelSelect] = useState(false)

  const { user } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  // Extract active session id from URL path
  const activeSessionId = pathname.startsWith('/chat/')
    ? parseInt(pathname.split('/').pop() || '', 10)
    : null

  const fetchSessions = async () => {
    try {
      const response = await api.get('/chat/sessions')
      setSessions(response.data)
    } catch (err) {
      console.error('Failed to fetch chat sessions:', err)
    } finally {
      setLoading(false)
    }
  };

  useEffect(() => {
    fetchSessions()
  }, [])

  const handleCreateSession = async (model: 'qwen' | 'deepseek') => {
    setCreating(true)
    setShowModelSelect(false)
    try {
      const title = model === 'qwen' ? 'Qwen 智能对话' : 'DeepSeek 对话'
      const response = await api.post('/chat/sessions', {
        title,
        model,
      })
      const newSession = response.data
      setSessions((prev) => [newSession, ...prev])
      router.push(`/chat/${newSession.id}`)
    } catch (err) {
      alert('创建对话失败')
    } finally {
      setCreating(false)
    }
  }

  const handleDeleteSession = async (id: number, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!confirm('确定要删除这个对话吗？')) return

    try {
      await api.delete(`/chat/sessions/${id}`)
      setSessions((prev) => prev.filter((s) => s.id !== id))
      // If we deleted the active session, redirect to index
      if (activeSessionId === id) {
        router.push('/chat')
      }
    } catch (err) {
      alert('删除失败')
    }
  }

  const startEditing = (id: number, currentTitle: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setEditingId(id)
    setEditTitle(currentTitle)
  }

  const cancelEditing = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setEditingId(null)
    setEditTitle('')
  }

  const handleRename = async (id: number, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!editTitle.trim()) return

    try {
      await api.patch(`/chat/sessions/${id}`, { title: editTitle })
      setSessions((prev) =>
        prev.map((s) => (s.id === id ? { ...s, title: editTitle } : s))
      )
      setEditingId(null)
    } catch (err) {
      alert('重命名失败')
    }
  }

  return (
    <ChatContext.Provider value={{ refreshSessions: fetchSessions }}>
      <div className="flex h-screen bg-surface dark:bg-darkBg text-onSurface dark:text-foreground overflow-hidden">
        {/* Sidebar */}
        <aside className={`w-full md:w-80 flex-shrink-0 border-r border-secondary dark:border-darkBorder flex flex-col bg-surface dark:bg-darkBg transition-colors duration-300 ${activeSessionId !== null && !isNaN(activeSessionId) ? 'hidden md:flex' : 'flex'}`}>
          {/* Header & Create */}
          <div className="p-4 border-b border-secondary dark:border-darkBorder space-y-3">
            <div className="flex items-center justify-between">
              <h1 className="text-xl font-bold tracking-tight text-onSurface dark:text-foreground">
                智能 AI 对话
              </h1>
              <Link href="/dashboard" className="text-xs text-primary font-medium hover:underline flex items-center">
                <Home size={14} className="mr-1" />
                控制台
              </Link>
            </div>

            <div className="relative">
              <Button
                onClick={() => setShowModelSelect(!showModelSelect)}
                disabled={creating}
                className="w-full flex items-center justify-center space-x-2 py-2.5 rounded-xl shadow-sm text-sm"
              >
                {creating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                <span>开启新对话</span>
              </Button>

              {/* Model Select Dropdown */}
              {showModelSelect && (
                <div className="absolute top-full left-0 right-0 mt-2 p-2 rounded-xl bg-white dark:bg-darkCard border border-secondary dark:border-darkBorder shadow-xl z-20 space-y-1 animate-fade-in">
                  <button
                    onClick={() => handleCreateSession('qwen')}
                    className="w-full text-left px-3 py-2.5 rounded-lg text-sm hover:bg-primary/10 transition-colors flex flex-col"
                  >
                    <span className="font-semibold text-onSurface dark:text-foreground">Qwen (通义千问)</span>
                    <span className="text-xs text-onSurface/60 dark:text-foreground/60">支持图片 + 文本输入 (gpt-5.5)</span>
                  </button>
                  <button
                    onClick={() => handleCreateSession('deepseek')}
                    className="w-full text-left px-3 py-2.5 rounded-lg text-sm hover:bg-primary/10 transition-colors flex flex-col"
                  >
                    <span className="font-semibold text-onSurface dark:text-foreground">DeepSeek</span>
                    <span className="text-xs text-onSurface/60 dark:text-foreground/60">智能逻辑推理 (仅限文本)</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Sessions List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-10 space-y-2">
                <Loader2 size={24} className="animate-spin text-primary/60" />
                <span className="text-xs text-onSurface/55">加载对话列表中...</span>
              </div>
            ) : sessions.length === 0 ? (
              <div className="text-center py-10 text-xs text-onSurface/40">
                暂无历史对话，点击上方开启吧
              </div>
            ) : (
              sessions.map((s) => {
                const isActive = activeSessionId === s.id
                const isEditing = editingId === s.id

                return (
                  <div
                    key={s.id}
                    onClick={() => !isEditing && router.push(`/chat/${s.id}`)}
                    className={`group relative flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all duration-200 border ${
                      isActive
                        ? 'bg-primary/10 border-primary/20 text-primary font-medium'
                        : 'border-transparent hover:bg-secondary/40 dark:hover:bg-darkBorder/40 text-onSurface/80 dark:text-foreground/80'
                    }`}
                  >
                    <div className="flex items-center space-x-2.5 min-w-0 flex-1">
                      <MessageSquare size={16} className="flex-shrink-0 text-onSurface/60 dark:text-foreground/60" />

                      {isEditing ? (
                        <input
                          type="text"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          className="bg-transparent border-b border-primary focus:outline-none text-sm w-full py-0.5 text-onSurface dark:text-foreground"
                          autoFocus
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <div className="truncate text-sm flex-1">
                          {s.title}
                          <span className="block text-[10px] text-onSurface/50 dark:text-foreground/50 font-normal">
                            {s.model === 'qwen' ? 'Qwen' : 'DeepSeek'}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Operations */}
                    <div className="flex items-center space-x-1 ml-2">
                      {isEditing ? (
                        <>
                          <button
                            onClick={(e) => handleRename(s.id, e)}
                            className="p-1 rounded-md text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
                          >
                            <Check size={14} />
                          </button>
                          <button
                            onClick={cancelEditing}
                            className="p-1 rounded-md text-error hover:bg-error/5"
                          >
                            <X size={14} />
                          </button>
                        </>
                      ) : (
                        <div className="opacity-0 group-hover:opacity-100 flex items-center space-x-1 transition-opacity duration-200">
                          <button
                            onClick={(e) => startEditing(s.id, s.title, e)}
                            className="p-1 rounded-md text-onSurface/60 dark:text-foreground/60 hover:bg-onSurface/10 hover:text-onSurface"
                            title="重命名"
                          >
                            <Edit3 size={13} />
                          </button>
                          <button
                            onClick={(e) => handleDeleteSession(s.id, e)}
                            className="p-1 rounded-md text-onSurface/60 dark:text-foreground/60 hover:bg-error/5 hover:text-error"
                            title="删除"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* User profile & Theme toggle */}
          <div className="p-4 border-t border-secondary dark:border-darkBorder bg-secondary/10 dark:bg-darkCard/30 flex items-center justify-between transition-colors duration-300">
            <div className="flex items-center space-x-2.5 min-w-0">
              <div className="h-8 w-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-xs select-none">
                {user?.display_name?.slice(0, 2) || user?.username?.slice(0, 2) || '用户'}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-onSurface dark:text-foreground truncate">
                  {user?.display_name || user?.username}
                </p>
                <p className="text-[10px] text-onSurface/55 dark:text-foreground/55 truncate">
                  {user?.email}
                </p>
              </div>
            </div>
            <ThemeToggle />
          </div>
        </aside>

        {/* Workspace details */}
        <main className={`flex-1 h-full overflow-hidden ${activeSessionId === null || isNaN(activeSessionId) ? 'hidden md:block' : 'block'}`}>
          {children}
        </main>
      </div>
    </ChatContext.Provider>
  )
}
