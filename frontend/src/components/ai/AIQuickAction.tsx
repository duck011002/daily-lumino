'use client'

import { useState } from 'react'
import { Loader2, Send, Sparkles } from 'lucide-react'
import api, { getErrorMessage } from '@/lib/api'
import ActionReceipt, { ActionReceiptData } from './ActionReceipt'

type ActionContext = 'general' | 'ledger' | 'todos' | 'blog' | 'library'

export default function AIQuickAction({
  context,
  placeholder,
  onCompleted,
}: {
  context: ActionContext
  placeholder: string
  onCompleted?: () => void | Promise<void>
}) {
  const [message, setMessage] = useState('')
  const [reply, setReply] = useState('')
  const [receipts, setReceipts] = useState<ActionReceiptData[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    const content = message.trim()
    if (!content || submitting) return
    setSubmitting(true)
    setError('')
    setReply('')
    setReceipts([])
    try {
      const response = await api.post<{
        text: string
        actions: ActionReceiptData[]
      }>('/ai/actions/interpret', {
        message: content,
        context,
        idempotency_key:
          typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random()}`,
      })
      setReply(response.data.text)
      setReceipts(response.data.actions)
      if (response.data.actions.length) {
        setMessage('')
        await onCompleted?.()
      }
    } catch (err) {
      setError(getErrorMessage(err, 'AI 暂时无法处理这条指令。'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="rounded-[1.6rem] border border-[#1d6347]/20 bg-[#fffdf8] p-4 shadow-sm dark:border-[#f7b84b]/20 dark:bg-darkCard">
      <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[#e4f0e8] text-[#1d6347] dark:bg-[#3d311b] dark:text-[#f7b84b]">
          <Sparkles size={18} />
        </span>
        <input
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder={placeholder}
          maxLength={4000}
          className="min-w-0 flex-1 rounded-2xl border border-[#17211d]/10 bg-white px-4 py-3 text-sm outline-none focus:border-[#1d6347] dark:border-darkBorder dark:bg-black/20"
        />
        <button
          type="submit"
          disabled={submitting || !message.trim()}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#1d6347] px-5 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-45 dark:bg-[#f7b84b] dark:text-[#241b0b]"
        >
          {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          执行
        </button>
      </form>
      {(reply || error || receipts.length > 0) && (
        <div className="mt-3 space-y-2 border-t border-[#17211d]/8 pt-3 dark:border-darkBorder">
          {reply && <p className="text-sm leading-6 text-[#17211d]/65 dark:text-foreground/65">{reply}</p>}
          {error && <p className="text-sm text-red-600 dark:text-red-300">{error}</p>}
          {receipts.map((receipt) => (
            <ActionReceipt key={receipt.action_id} receipt={receipt} onUndone={onCompleted} />
          ))}
        </div>
      )}
    </section>
  )
}
