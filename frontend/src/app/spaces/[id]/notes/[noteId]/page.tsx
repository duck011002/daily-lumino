'use client'

import React, { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Loader2, Save, Lock, AlertCircle, CheckCircle } from 'lucide-react'
import dynamic from 'next/dynamic'
import { useAuth } from '@/hooks/useAuth'
import { useTheme } from '@/hooks/useTheme'
import api from '@/lib/api'
import Button from '@/components/ui/Button'
import ThemeToggle from '@/components/layout/ThemeToggle'

// Dynamic import of markdown editor to prevent hydration errors during SSR
const MDEditor = dynamic(
  () => import('@uiw/react-md-editor').then((mod) => mod.default),
  { ssr: false }
)

// Dynamic import of markdown preview for when we're in read-only mode or loading
const MDPreview = dynamic(
  () => import('@uiw/react-markdown-preview').then((mod) => mod.default),
  { ssr: false }
)

import '@uiw/react-md-editor/markdown-editor.css'
import '@uiw/react-markdown-preview/markdown.css'

interface NoteDetail {
  id: number
  space_id: number
  title: string
  content: string | null
  cover_url: string | null
  author_id: number
  lock_by: number | null
  lock_at: string | null
  is_published: boolean
  created_at: string
  updated_at: string
}

export default function NoteEditorPage() {
  const params = useParams()
  const router = useRouter()
  const spaceId = params.id as string
  const noteId = params.noteId as string
  const { user } = useAuth()
  const { isDark } = useTheme()

  const [note, setNote] = useState<NoteDetail | null>(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState<string | undefined>('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [saveMessage, setSaveMessage] = useState('')

  // Locking state
  const [isReadOnly, setIsReadOnly] = useState(false)
  const [lockWarning, setLockWarning] = useState('')
  const [hasLock, setHasLock] = useState(false)

  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Fetch the note details and attempt to lock
  const fetchNoteAndAcquireLock = async () => {
    try {
      // 1. Fetch note info
      const noteRes = await api.get(`/spaces/${spaceId}/notes/${noteId}`)
      const fetchedNote = noteRes.data
      setNote(fetchedNote)
      setTitle(fetchedNote.title)
      setContent(fetchedNote.content || '')

      // 2. Try to acquire editing lock
      try {
        await api.post(`/spaces/${spaceId}/notes/${noteId}/lock`)
        setIsReadOnly(false)
        setHasLock(true)
        setLockWarning('')
        startHeartbeat()
      } catch (lockErr: any) {
        if (lockErr.response?.status === 409) {
          setIsReadOnly(true)
          setHasLock(false)
          setLockWarning(lockErr.response.data?.detail || '其他成员正在编辑此记录，当前为只读模式。')
        } else {
          console.error('获取锁异常', lockErr)
          // Default fallback
          setIsReadOnly(true)
        }
      }
    } catch (err: any) {
      alert(err.response?.data?.detail || '加载记录失败。')
      router.push(`/spaces/${spaceId}/notes`)
    } finally {
      setLoading(false)
    }
  }

  // Heartbeat function to maintain editing lock
  const startHeartbeat = () => {
    // Clear any existing heartbeat
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current)
    }

    // Ping every 5 minutes (300,000 ms)
    heartbeatIntervalRef.current = setInterval(async () => {
      try {
        await api.post(`/spaces/${spaceId}/notes/${noteId}/heartbeat`)
      } catch (err: any) {
        console.error('发送心跳锁失败', err)
        // Heartbeat failed (e.g. lock taken over or session expired)
        setIsReadOnly(true)
        setHasLock(false)
        setLockWarning('您的编辑锁已过期或被其他成员接管，已自动切换为只读模式。')
        if (heartbeatIntervalRef.current) {
          clearInterval(heartbeatIntervalRef.current)
        }
      }
    }, 5 * 60 * 1000)
  }

  // Release lock
  const releaseLock = async () => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current)
    }
    if (hasLock) {
      try {
        await api.delete(`/spaces/${spaceId}/notes/${noteId}/lock`)
      } catch (err) {
        console.error('释放编辑锁失败', err)
      }
    }
  }

  // Save changes
  const handleSave = async () => {
    if (isReadOnly) return
    if (!title.trim()) {
      alert('标题不能为空')
      return
    }

    setSaving(true)
    setSaveStatus('idle')
    try {
      const res = await api.patch(`/spaces/${spaceId}/notes/${noteId}`, {
        title: title.trim(),
        content: content || '',
      })
      setNote(res.data)
      setSaveStatus('success')
      setSaveMessage('记录保存成功！')
      
      // Auto fade-out save message
      setTimeout(() => {
        setSaveStatus('idle')
      }, 3000)
    } catch (err: any) {
      setSaveStatus('error')
      setSaveMessage(err.response?.data?.detail || '保存记录失败，请检查网络。')
      
      // If we got locked out during save (e.g. 409)
      if (err.response?.status === 409) {
        setIsReadOnly(true)
        setHasLock(false)
        setLockWarning(err.response.data?.detail)
      }
    } finally {
      setSaving(false)
    }
  }

  // Setup mount & unmount effects
  useEffect(() => {
    fetchNoteAndAcquireLock()

    return () => {
      // Release lock when page unmounts (React navigation)
      releaseLock()
    }
  }, [spaceId, noteId])

  // Setup beforeunload listener to release lock when closing tab/browser
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (hasLock) {
        // Send async call using fetch keepalive to ensure execution during unload
        const url = `${api.defaults.baseURL || ''}/spaces/${spaceId}/notes/${noteId}/lock`
        fetch(url, {
          method: 'DELETE',
          // Send credentials if api is hosted on the same port or uses cookies
          credentials: 'include',
          keepalive: true,
        }).catch(console.error)
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [spaceId, noteId, hasLock])

  // Listen to keyboard shortcut (Ctrl+S / Cmd+S)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        handleSave()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [title, content, isReadOnly])

  if (loading) {
    return (
      <div className="min-h-screen bg-surface dark:bg-darkBg flex items-center justify-center">
        <Loader2 className="animate-spin text-primary h-8 w-8" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface dark:bg-darkBg flex flex-col transition-colors duration-300">
      {/* Header */}
      <header className="w-full border-b border-secondary dark:border-darkBorder bg-white/50 dark:bg-darkCard/50 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3 flex-1 mr-4">
            <Link
              href={`/spaces/${spaceId}/notes`}
              className="text-primary hover:text-primary/80 transition-colors flex-shrink-0"
              onClick={releaseLock}
            >
              <ArrowLeft size={20} />
            </Link>
            
            {/* Title Input */}
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isReadOnly}
              placeholder="请输入标题..."
              className="bg-transparent text-lg font-bold text-onSurface dark:text-foreground focus:outline-none focus:border-b focus:border-primary/50 w-full px-1 py-0.5 border-b border-transparent transition-colors disabled:opacity-80"
              maxLength={300}
            />
          </div>

          <div className="flex items-center space-x-3 flex-shrink-0">
            {!isReadOnly && (
              <Button onClick={handleSave} isLoading={saving} size="sm" className="shadow-sm">
                <Save size={16} className="mr-1" /> 保存
              </Button>
            )}
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main Editor Workspace */}
      <main className="flex-1 w-full max-w-6xl mx-auto px-6 py-4 flex flex-col space-y-4">
        {/* Warning/Info Banner */}
        {isReadOnly && (
          <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-500/20 flex items-center space-x-2 text-sm animate-fade-in shadow-sm">
            <Lock className="h-4 w-4 text-amber-500 flex-shrink-0" />
            <div className="flex-1 font-medium">{lockWarning}</div>
          </div>
        )}

        {/* Save Status Alert Banner */}
        {saveStatus === 'success' && (
          <div className="p-3 rounded-xl bg-green-50 dark:bg-green-500/10 text-green-800 dark:text-green-300 border border-green-200 dark:border-green-500/20 flex items-center space-x-2 text-sm animate-fade-in shadow-sm">
            <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
            <div className="flex-1 font-medium">{saveMessage}</div>
          </div>
        )}
        {saveStatus === 'error' && (
          <div className="p-3 rounded-xl bg-red-50 dark:bg-red-500/10 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-500/20 flex items-center space-x-2 text-sm animate-fade-in shadow-sm">
            <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
            <div className="flex-1 font-medium">{saveMessage}</div>
          </div>
        )}

        {/* Markdown Editor Wrapper */}
        <div className="flex-1 min-h-[500px] flex flex-col rounded-2xl border border-secondary dark:border-darkBorder overflow-hidden bg-white dark:bg-darkCard shadow-sm" data-color-mode={isDark ? 'dark' : 'light'}>
          {isReadOnly ? (
            <div className="p-8 overflow-y-auto max-h-[800px] prose dark:prose-invert max-w-none text-onSurface dark:text-foreground">
              {content ? (
                <MDPreview source={content} />
              ) : (
                <p className="text-onSurface/40 dark:text-foreground/40 italic">暂无内容...</p>
              )}
            </div>
          ) : (
            <MDEditor
              value={content}
              onChange={setContent}
              height="100%"
              minHeight={500}
              preview="live"
              className="flex-1 bg-white dark:bg-darkCard text-onSurface dark:text-foreground border-none"
            />
          )}
        </div>

        <div className="flex justify-between items-center text-xs text-onSurface/40 dark:text-foreground/40">
          <span>提示: {!isReadOnly ? '可以使用 Ctrl+S / ⌘+S 快捷键快速保存记录' : '当前处于只读模式，无法编辑内容'}</span>
          <span>字符数: {content?.length || 0}</span>
        </div>
      </main>
    </div>
  )
}
