'use client'

import { useEffect, useState } from 'react'
import { Bot, Copy, KeyRound, Loader2 } from 'lucide-react'
import api, { getErrorMessage } from '@/lib/api'

interface LibraryToken { id: number; label: string; is_active: boolean; created_at: string; last_used_at: string | null }

export default function LibraryMcpPanel() {
  const [tokens, setTokens] = useState<LibraryToken[]>([])
  const [label, setLabel] = useState('Codex Desktop')
  const [newToken, setNewToken] = useState('')
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [message, setMessage] = useState('')
  useEffect(() => { api.get<LibraryToken[]>('/admin/mcp-library/tokens').then((r) => setTokens(r.data)).catch((e) => setMessage(getErrorMessage(e, '读取书房 MCP 凭据失败。'))).finally(() => setLoading(false)) }, [])
  const createToken = async () => { if (!label.trim()) return; setCreating(true); setMessage(''); try { const r = await api.post<LibraryToken & { token: string }>('/admin/mcp-library/tokens', { label: label.trim() }); setNewToken(r.data.token); setTokens((v) => [r.data, ...v]) } catch (e) { setMessage(getErrorMessage(e, '创建书房 MCP 凭据失败。')) } finally { setCreating(false) } }
  const toggle = async (token: LibraryToken) => { try { const r = await api.patch<LibraryToken>(`/admin/mcp-library/tokens/${token.id}`, { is_active: !token.is_active }); setTokens((v) => v.map((x) => x.id === token.id ? r.data : x)) } catch (e) { setMessage(getErrorMessage(e, '更新书房 MCP 凭据失败。')) } }
  const origin = typeof window === 'undefined' ? 'https://lovestory1314.fun' : window.location.origin
  const command = `codex mcp add lumino-library --url ${origin}/api/mcp/library/ --bearer-token-env-var LUMINO_LIBRARY_MCP_TOKEN`
  return <section id="library-mcp" className="scroll-mt-40 rounded-[2rem] border border-stone-200 bg-white p-5 shadow-sm dark:border-stone-800 dark:bg-stone-900 sm:p-7">
    <div className="flex items-start gap-3"><span className="rounded-2xl bg-sky-100 p-2.5 text-sky-700 dark:bg-sky-950 dark:text-sky-300"><Bot className="h-5 w-5" /></span><div><h2 className="text-lg font-semibold">书房 AI 助手 MCP</h2><p className="mt-1 text-sm leading-6 text-stone-500">可直接修改书房资料、公开链接和收藏卡片；是否公开由每条内容的公开开关决定。</p></div></div>
    <div className="mt-6 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]"><input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={100} placeholder="凭据名称" className="rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm outline-none focus:border-sky-500 dark:border-stone-700 dark:bg-stone-950" /><button type="button" onClick={createToken} disabled={creating || !label.trim()} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-sky-700 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}创建凭据</button></div>
    {newToken && <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200"><p className="font-semibold">令牌只显示一次，请立即复制</p><div className="mt-2 flex gap-2"><code className="min-w-0 flex-1 break-all rounded-xl bg-white/70 p-3 text-xs dark:bg-black/20">{newToken}</code><button type="button" title="复制令牌" onClick={() => navigator.clipboard.writeText(newToken)} className="rounded-xl border border-amber-300 p-3"><Copy className="h-4 w-4" /></button></div></div>}
    <div className="mt-4 rounded-2xl bg-stone-50 p-4 dark:bg-stone-950"><p className="text-xs font-semibold text-stone-500">连接命令</p><div className="mt-2 flex gap-2"><code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap text-xs">{command}</code><button type="button" title="复制连接命令" onClick={() => navigator.clipboard.writeText(command)}><Copy className="h-4 w-4" /></button></div></div>
    {message && <p className="mt-4 text-sm text-red-600 dark:text-red-400">{message}</p>}
    {loading ? <Loader2 className="mx-auto mt-6 h-5 w-5 animate-spin" /> : <div className="mt-5 space-y-2">{tokens.length === 0 ? <p className="text-sm text-stone-400">尚未创建凭据。</p> : tokens.map((token) => <div key={token.id} className="flex items-center justify-between gap-3 rounded-2xl border border-stone-200 px-4 py-3 dark:border-stone-800"><div><p className="text-sm font-medium">{token.label}</p><p className="mt-1 text-xs text-stone-400">最近使用：{token.last_used_at ? new Date(token.last_used_at).toLocaleString() : '尚未使用'}</p></div><button type="button" onClick={() => toggle(token)} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${token.is_active ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'}`}>{token.is_active ? '启用中' : '已停用'}</button></div>)}</div>}
  </section>
}
