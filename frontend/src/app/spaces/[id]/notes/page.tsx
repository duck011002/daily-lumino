'use client'

import React, { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, FileText, Plus, Loader2, Trash2, Lock, FileEdit, Notebook } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import api from '@/lib/api'
import Button from '@/components/ui/Button'
import ThemeToggle from '@/components/layout/ThemeToggle'

interface UserResponse {
  id: number
  username: string
  display_name: string | null
}

interface Note {
  id: number
  space_id: number
  title: str
  content: string | null
  cover_url: string | null
  author_id: number
  lock_by: number | null
  lock_at: string | null
  is_published: boolean
  created_at: string
  updated_at: string
  author: UserResponse | null
  locked_user: UserResponse | null
}

export default function SpaceNotesPage() {
  const params = useParams()
  const router = useRouter()
  const spaceId = params.id as string
  const { user } = useAuth()

  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Create Note popup/state
  const [showCreate, setShowCreate] = useState(false)
  const [createTitle, setCreateTitle] = useState('')
  const [creating, setCreating] = useState(false)

  const fetchNotes = async () => {
    try {
      const res = await api.get(`/spaces/${spaceId}/notes`)
      setNotes(res.data)
    } catch (err: any) {
      setError(err.response?.data?.detail || '无法加载空间记录。')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchNotes()
  }, [spaceId])

  const handleCreateNote = async () => {
    if (!createTitle.trim()) return
    setCreating(true)
    try {
      const res = await api.post(`/spaces/${spaceId}/notes`, {
        title: createTitle,
        content: '# ' + createTitle + '\n\n',
      })
      // Redirect straight to the editor page of the newly created note
      router.push(`/spaces/${spaceId}/notes/${res.data.id}`)
    } catch (err: any) {
      alert(err.response?.data?.detail || '创建记录失败。')
      setCreating(false)
    }
  }

  const handleDeleteNote = async (e: React.MouseEvent, noteId: number) => {
    e.preventDefault()
    e.stopPropagation()
    if (!confirm('确定要删除这条记录吗？删除后将无法恢复。')) return

    try {
      await api.delete(`/spaces/${spaceId}/notes/${noteId}`)
      setNotes((prev) => prev.filter((n) => n.id !== noteId))
    } catch (err: any) {
      alert(err.response?.data?.detail || '删除失败。')
    }
  }

  const isNoteLocked = (note: Note) => {
    if (!note.lock_by || !note.lock_at) return false
    
    // Normalize ISO date to UTC
    const dateStr = note.lock_at
    const normalizedStr = dateStr.endsWith('Z') || dateStr.includes('+') ? dateStr : dateStr + 'Z'
    const lockTime = new Date(normalizedStr).getTime()
    const now = new Date().getTime()
    
    // 30 minutes active limit
    return (now - lockTime) < 30 * 60 * 1000
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
            <FileText className="h-6 w-6 text-primary" />
            <h1 className="text-lg font-bold text-onSurface dark:text-foreground">空间记录</h1>
          </div>
          <div className="flex items-center space-x-3">
            <Button onClick={() => setShowCreate(true)} size="sm" className="shadow-sm">
              <Plus size={16} className="mr-1" /> 新建记录
            </Button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Create Form Modal Area */}
        {showCreate && (
          <div className="mb-8 p-6 rounded-2xl border border-secondary dark:border-darkBorder bg-white dark:bg-darkCard shadow-sm animate-fade-in max-w-md">
            <h3 className="text-lg font-bold text-onSurface dark:text-foreground mb-4">创建新记录</h3>
            <input
              type="text"
              placeholder="请输入记录标题"
              value={createTitle}
              onChange={(e) => setCreateTitle(e.target.value)}
              className="w-full rounded-xl border border-secondary dark:border-darkBorder bg-surface dark:bg-darkBg px-4 py-2.5 text-sm mb-4 focus:outline-none focus:ring-1 focus:ring-primary/50 text-onSurface dark:text-foreground"
              maxLength={300}
            />
            <div className="flex gap-2">
              <Button onClick={handleCreateNote} isLoading={creating} disabled={!createTitle.trim()}>
                确认创建
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setShowCreate(false)
                  setCreateTitle('')
                }}
              >
                取消
              </Button>
            </div>
          </div>
        )}

        {/* Notes Grid */}
        {notes.length === 0 ? (
          <div className="text-center py-20 space-y-4">
            <div className="inline-flex h-16 w-16 rounded-3xl bg-primary/10 text-primary items-center justify-center font-bold">
              <Notebook size={24} />
            </div>
            <h3 className="text-xl font-bold text-onSurface dark:text-foreground">空空如也</h3>
            <p className="text-sm text-onSurface/60 dark:text-foreground/60 max-w-sm mx-auto">
              空间内还没有任何记录。点击右上方“新建记录”来写下你们的故事吧。
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {notes.map((note) => {
              const locked = isNoteLocked(note)
              return (
                <Link key={note.id} href={`/spaces/${spaceId}/notes/${note.id}`}>
                  <div className="group p-6 rounded-2xl border border-secondary dark:border-darkBorder bg-white dark:bg-darkCard hover:shadow-lg transition-all duration-300 hover:translate-y-[-2px] flex flex-col justify-between h-48 cursor-pointer relative overflow-hidden">
                    <div>
                      <div className="flex items-start justify-between">
                        <h3 className="font-bold text-base text-onSurface dark:text-foreground truncate flex-1 pr-2">
                          {note.title}
                        </h3>
                        {locked && (
                          <span
                            className="inline-flex items-center text-xs px-2 py-1 rounded-md bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 gap-1 border border-amber-200/50 dark:border-amber-500/20"
                            title={`当前由 ${note.locked_user?.display_name || note.locked_user?.username} 编辑中`}
                          >
                            <Lock size={12} />
                            <span className="max-w-[80px] truncate">
                              {note.locked_user?.display_name || note.locked_user?.username}
                            </span>
                          </span>
                        )}
                      </div>
                      
                      <p className="text-xs text-onSurface/60 dark:text-foreground/60 mt-3 line-clamp-3 overflow-hidden text-ellipsis whitespace-pre-wrap">
                        {note.content ? note.content.replace(/[#*`>_\-]/g, '').trim() : '暂无内容...'}
                      </p>
                    </div>

                    <div className="flex items-center justify-between text-xs text-onSurface/50 dark:text-foreground/50 border-t border-secondary/50 dark:border-darkBorder/50 pt-3 mt-4">
                      <div>
                        <span>作者: {note.author?.display_name || note.author?.username}</span>
                        <span className="mx-2">·</span>
                        <span>{new Date(note.created_at).toLocaleDateString()}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="p-1.5 hover:bg-primary/10 hover:text-primary rounded-lg transition-colors">
                          <FileEdit size={14} />
                        </span>
                        <button
                          onClick={(e) => handleDeleteNote(e, note.id)}
                          className="p-1.5 hover:bg-red-50 dark:hover:bg-red-500/15 text-onSurface/40 hover:text-red-500 rounded-lg transition-colors"
                          title="删除记录"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
