'use client'

/** Lumino Todo Module v1.1.0 **/
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Bell,
  CheckCircle2,
  Clock,
  Plus,
  Trash2,
  AlertCircle,
  Sparkles,
  ExternalLink,
} from 'lucide-react'
import api, { getErrorMessage } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import BackLink from '@/components/ui/BackLink'
import ThemeToggle from '@/components/layout/ThemeToggle'
import AIQuickAction from '@/components/ai/AIQuickAction'

interface TodoItem {
  id: number
  title: string
  description: string | null
  priority: 'low' | 'medium' | 'high'
  status: 'pending' | 'completed' | 'cancelled'
  due_at: string | null
  remind_at: string | null
  source_url: string | null
  created_at: string
}

export default function TodosPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [todos, setTodos] = useState<TodoItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [newTitle, setNewTitle] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium')
  const [notificationGranted, setNotificationGranted] = useState(false)

  const loadTodos = async () => {
    setLoading(true)
    try {
      const res = await api.get<TodoItem[]>('/todos')
      setTodos(res.data)
    } catch (err) {
      setError(getErrorMessage(err, '加载待办事项失败'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      router.replace('/login')
      return
    }
    loadTodos()
    if (typeof Notification !== 'undefined') {
      setNotificationGranted(Notification.permission === 'granted')
    }
  }, [user, authLoading])

  const requestNotificationPermission = async () => {
    if (typeof Notification === 'undefined') {
      alert('您的浏览器不支持桌面通知。')
      return
    }
    const permission = await Notification.requestPermission()
    if (permission === 'granted') {
      setNotificationGranted(true)
      new Notification('Lumino 消息通知已开启', {
        body: '有待办提醒时，我们将第一时间通知您。',
      })
    } else {
      alert('通知权限未开启，无法发送桌面提醒。')
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTitle.trim()) return
    try {
      await api.post('/todos', {
        title: newTitle.trim(),
        description: newDesc.trim() || null,
        priority,
      })
      setNewTitle('')
      setNewDesc('')
      loadTodos()
    } catch (err) {
      alert(getErrorMessage(err, '创建待办失败'))
    }
  }

  const toggleStatus = async (todo: TodoItem) => {
    const nextStatus = todo.status === 'pending' ? 'completed' : 'pending'
    try {
      await api.patch(`/todos/${todo.id}`, { status: nextStatus })
      loadTodos()
    } catch (err) {
      alert(getErrorMessage(err, '更新状态失败'))
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('确定要删除这条待办吗？')) return
    try {
      await api.delete(`/todos/${id}`)
      loadTodos()
    } catch (err) {
      alert(getErrorMessage(err, '删除失败'))
    }
  }

  return (
    <div className="min-h-screen bg-[#F1EEE5] text-stone-800 dark:bg-stone-950 dark:text-stone-100">
      <header className="sticky top-0 z-20 border-b border-stone-200/80 bg-[#F1EEE5]/80 backdrop-blur-md dark:border-stone-800 dark:bg-stone-950/80">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4 sm:px-6">
          <BackLink href="/" label="返回首页" />
          <h1 className="font-serif text-lg font-bold">待办与灵感清单</h1>
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <div className="mb-6">
          <AIQuickAction
            context="todos"
            placeholder="告诉 AI：明天下午三点提醒我提交报告"
            onCompleted={loadTodos}
          />
        </div>
        {/* 通知权限 Banner */}
        <div className="mb-6 flex flex-col items-start justify-between gap-4 rounded-3xl border border-amber-200/70 bg-gradient-to-r from-amber-50 to-orange-50 p-5 shadow-sm sm:flex-row sm:items-center dark:border-amber-900/40 dark:from-amber-950/30 dark:to-orange-950/20">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-amber-500/20 p-2.5 text-amber-700 dark:text-amber-300">
              <Bell size={20} />
            </div>
            <div>
              <p className="font-bold text-stone-900 dark:text-stone-100">系统提醒通知</p>
              <p className="text-xs text-stone-600 dark:text-stone-400">
                {notificationGranted ? '已成功开启桌面通知提醒' : '开启桌面通知，不错过重要事项与打卡提醒'}
              </p>
            </div>
          </div>
          {!notificationGranted && (
            <button
              onClick={requestNotificationPermission}
              className="rounded-2xl bg-amber-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-amber-700 shadow-sm"
            >
              开启通知权限
            </button>
          )}
        </div>

        {/* 新建框 */}
        <form onSubmit={handleCreate} className="mb-8 rounded-3xl border border-stone-200/90 bg-white/80 p-5 shadow-sm dark:border-stone-800 dark:bg-stone-900/80">
          <h2 className="mb-3 font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
            <Sparkles size={16} className="text-amber-500" />
            快速记录新事项
          </h2>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              type="text"
              placeholder="需要完成的事项或灵感..."
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="flex-1 rounded-2xl border border-stone-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-emerald-600 dark:border-stone-700 dark:bg-stone-800"
            />
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as any)}
              className="rounded-2xl border border-stone-200 bg-white px-3 py-2.5 text-sm outline-none dark:border-stone-700 dark:bg-stone-800"
            >
              <option value="low">低优先级</option>
              <option value="medium">中优先级</option>
              <option value="high">高优先级</option>
            </select>
            <button
              type="submit"
              className="flex items-center justify-center gap-1.5 rounded-2xl bg-emerald-800 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-700"
            >
              <Plus size={16} />
              添加
            </button>
          </div>
        </form>

        {/* 待办列表 */}
        {loading ? (
          <div className="py-12 text-center text-sm text-stone-400">加载待办列表中...</div>
        ) : todos.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-stone-300 p-12 text-center text-stone-400 dark:border-stone-800">
            目前暂无待办事项，喝杯茶休息一下吧。
          </div>
        ) : (
          <div className="space-y-3">
            {todos.map((todo) => (
              <div
                key={todo.id}
                className={`group flex items-center justify-between gap-4 rounded-3xl border p-4 transition ${
                  todo.status === 'completed'
                    ? 'border-stone-200 bg-stone-100/60 opacity-60 dark:border-stone-800/60 dark:bg-stone-900/40'
                    : 'border-stone-200/90 bg-white/90 shadow-sm dark:border-stone-800 dark:bg-stone-900'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    onClick={() => toggleStatus(todo)}
                    className={`rounded-full p-1 transition ${
                      todo.status === 'completed' ? 'text-emerald-600' : 'text-stone-400 hover:text-emerald-600'
                    }`}
                  >
                    <CheckCircle2 size={22} />
                  </button>
                  <div className="min-w-0">
                    <p className={`font-medium ${todo.status === 'completed' ? 'line-through text-stone-400' : ''}`}>
                      {todo.title}
                    </p>
                    {todo.source_url && (
                      <a
                        href={todo.source_url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 flex items-center gap-1 text-xs text-amber-600 hover:underline"
                      >
                        <ExternalLink size={12} />
                        来源链接
                      </a>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span
                    className={`rounded-xl px-2.5 py-1 text-xs font-semibold ${
                      todo.priority === 'high'
                        ? 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300'
                        : todo.priority === 'medium'
                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                        : 'bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-400'
                    }`}
                  >
                    {todo.priority === 'high' ? '高优' : todo.priority === 'medium' ? '中优' : '低优'}
                  </span>
                  <button
                    onClick={() => handleDelete(todo.id)}
                    className="p-1 text-stone-400 hover:text-red-500 transition"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
