'use client'

import { useState } from 'react'
import { FileText, Loader2, Save, X } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import api, { getErrorMessage } from '@/lib/api'
import { ActionReceiptData } from './ActionReceipt'

export interface ActionProposalData {
  id: number
  tool: string
  arguments: {
    title?: string
    content?: string
    excerpt?: string | null
    [key: string]: unknown
  }
  status: string
  expires_at: string
}

export default function ActionProposal({
  proposal,
  onConfirmed,
  onCancelled,
}: {
  proposal: ActionProposalData
  onConfirmed?: (receipt: ActionReceiptData) => void | Promise<void>
  onCancelled?: (proposalId: number) => void | Promise<void>
}) {
  const [acting, setActing] = useState<'confirm' | 'cancel' | null>(null)
  const [error, setError] = useState('')

  const confirm = async () => {
    setActing('confirm')
    setError('')
    try {
      const response = await api.post<ActionReceiptData>(
        `/ai/actions/proposals/${proposal.id}/confirm`
      )
      await onConfirmed?.(response.data)
    } catch (err) {
      setError(getErrorMessage(err, '保存草稿失败。'))
    } finally {
      setActing(null)
    }
  }

  const cancel = async () => {
    setActing('cancel')
    setError('')
    try {
      await api.post(`/ai/actions/proposals/${proposal.id}/cancel`)
      await onCancelled?.(proposal.id)
    } catch (err) {
      setError(getErrorMessage(err, '取消提案失败。'))
    } finally {
      setActing(null)
    }
  }

  return (
    <article className="overflow-hidden rounded-2xl border border-[#b56b19]/25 bg-[#fffaf1] shadow-sm dark:border-[#f7b84b]/25 dark:bg-darkCard">
      <header className="flex items-center gap-3 border-b border-[#b56b19]/15 px-4 py-3 dark:border-[#f7b84b]/15">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#b56b19]/10 text-[#b56b19] dark:text-[#f7b84b]">
          <FileText size={17} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#b56b19] dark:text-[#f7b84b]">博客私密预览</p>
          <h3 className="truncate font-semibold text-[#17211d] dark:text-foreground">
            {proposal.arguments.title || '未命名博客'}
          </h3>
        </div>
      </header>
      <div className="max-h-80 overflow-y-auto px-5 py-4 text-sm leading-7 text-[#17211d]/75 dark:text-foreground/75">
        <ReactMarkdown>{proposal.arguments.content || '暂无正文'}</ReactMarkdown>
      </div>
      <footer className="border-t border-[#b56b19]/15 px-4 py-3 dark:border-[#f7b84b]/15">
        <p className="mb-3 text-xs text-[#17211d]/50 dark:text-foreground/50">
          确认后仅保存为私密草稿，不会公开发布。
        </p>
        {error && <p className="mb-3 text-xs text-red-600 dark:text-red-300">{error}</p>}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={confirm}
            disabled={acting !== null}
            className="inline-flex items-center gap-2 rounded-xl bg-[#163a2b] px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
          >
            {acting === 'confirm' ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            保存为草稿
          </button>
          <button
            type="button"
            onClick={cancel}
            disabled={acting !== null}
            className="inline-flex items-center gap-2 rounded-xl border border-[#17211d]/15 px-4 py-2 text-xs font-semibold text-[#17211d]/65 disabled:opacity-50 dark:border-darkBorder dark:text-foreground/65"
          >
            {acting === 'cancel' ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />}
            取消
          </button>
        </div>
      </footer>
    </article>
  )
}
