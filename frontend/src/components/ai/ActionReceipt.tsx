'use client'

import { useState } from 'react'
import { CheckCircle2, Loader2, RotateCcw } from 'lucide-react'
import api, { getErrorMessage } from '@/lib/api'

export interface ActionReceiptData {
  action_id: number
  tool: string
  status: 'succeeded' | 'undone' | 'failed'
  result: Record<string, unknown> | null
  target_type: string | null
  target_id: number | null
  can_undo: boolean
  created_at: string
}

const ACTION_LABELS: Record<string, string> = {
  create_ledger_entry: '已新增账目',
  update_ledger_entry: '已更新账目',
  delete_ledger_entry: '已删除账目',
  create_todo: '已新增待办',
  update_todo: '已更新待办',
  delete_todo: '已删除待办',
  create_blog_post: '已新增博客草稿',
  update_blog_post: '已更新博客',
  publish_blog_post: '已公开发布博客',
  update_library_profile: '已更新 Library',
  upsert_library_media_card: '已更新 Library 收藏',
}

export default function ActionReceipt({
  receipt,
  onUndone,
}: {
  receipt: ActionReceiptData
  onUndone?: (receipt: ActionReceiptData) => void
}) {
  const [current, setCurrent] = useState(receipt)
  const [undoing, setUndoing] = useState(false)
  const [error, setError] = useState('')

  const undo = async () => {
    setUndoing(true)
    setError('')
    try {
      const response = await api.post<ActionReceiptData>(
        `/ai/actions/${current.action_id}/undo`
      )
      setCurrent(response.data)
      onUndone?.(response.data)
    } catch (err) {
      setError(getErrorMessage(err, '撤销失败，请在对应模块中手工修改。'))
    } finally {
      setUndoing(false)
    }
  }

  const undone = current.status === 'undone'
  return (
    <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/80 p-3 text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/25 dark:text-emerald-200">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <CheckCircle2 size={16} className="shrink-0" />
          <span className="truncate text-xs font-bold">
            {undone ? '已撤销' : ACTION_LABELS[current.tool] || '操作已完成'}
          </span>
          {current.target_id && (
            <span className="font-mono text-[10px] opacity-45">#{current.target_id}</span>
          )}
        </div>
        {current.can_undo && !undone && (
          <button
            onClick={undo}
            disabled={undoing}
            className="inline-flex items-center gap-1 rounded-xl border border-emerald-700/20 px-2.5 py-1.5 text-[11px] font-bold transition hover:bg-emerald-100 disabled:opacity-50 dark:hover:bg-emerald-900/40"
          >
            {undoing ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />}
            撤销
          </button>
        )}
      </div>
      {error && <p className="mt-2 text-[11px] text-red-600 dark:text-red-300">{error}</p>}
    </div>
  )
}
