'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  CircleDollarSign,
  Loader2,
  Plus,
  ReceiptText,
  Tags,
  Trash2,
  WalletCards,
} from 'lucide-react'
import BackLink from '@/components/ui/BackLink'
import ThemeToggle from '@/components/layout/ThemeToggle'
import { useAuth } from '@/hooks/useAuth'
import api, { getErrorMessage } from '@/lib/api'

type EntryType = 'expense' | 'income'

interface LedgerCategory {
  id: number
  name: string
  entry_type: EntryType
  is_default: boolean
  is_archived: boolean
}

interface LedgerEntry {
  id: number
  entry_type: EntryType
  amount: string
  occurred_at: string
  note: string | null
  category: LedgerCategory
}

interface CategoryTotal {
  category_id: number
  category_name: string
  entry_type: EntryType
  total: string
}

interface LedgerSummary {
  year: number
  month: number
  income_total: string
  expense_total: string
  balance: string
  category_totals: CategoryTotal[]
}

const money = new Intl.NumberFormat('zh-CN', {
  style: 'currency',
  currency: 'CNY',
  minimumFractionDigits: 2,
})

function toLocalDateInput(date = new Date()) {
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 10)
}

export default function LedgerPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const today = useMemo(() => new Date(), [])
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth() + 1)
  const [categories, setCategories] = useState<LedgerCategory[]>([])
  const [entries, setEntries] = useState<LedgerEntry[]>([])
  const [summary, setSummary] = useState<LedgerSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [entryType, setEntryType] = useState<EntryType>('expense')
  const [amount, setAmount] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [note, setNote] = useState('')
  const [occurredOn, setOccurredOn] = useState(toLocalDateInput())
  const [newCategoryName, setNewCategoryName] = useState('')

  const activeCategories = useMemo(
    () => categories.filter((item) => item.entry_type === entryType && !item.is_archived),
    [categories, entryType]
  )

  const loadLedger = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [categoriesResult, entriesResult, summaryResult] = await Promise.all([
        api.get<LedgerCategory[]>('/ledger/categories'),
        api.get<LedgerEntry[]>(`/ledger/entries?year=${year}&month=${month}`),
        api.get<LedgerSummary>(`/ledger/summary?year=${year}&month=${month}`),
      ])
      setCategories(categoriesResult.data)
      setEntries(entriesResult.data)
      setSummary(summaryResult.data)
    } catch (err) {
      setError(getErrorMessage(err, '账本加载失败，请稍后重试。'))
    } finally {
      setLoading(false)
    }
  }, [year, month])

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      router.replace('/login')
      return
    }
    loadLedger()
  }, [authLoading, user, router, loadLedger])

  useEffect(() => {
    if (!activeCategories.some((item) => String(item.id) === categoryId)) {
      setCategoryId(activeCategories[0] ? String(activeCategories[0].id) : '')
    }
  }, [activeCategories, categoryId])

  const handleCreateEntry = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!amount || Number(amount) <= 0 || !categoryId) return
    setSaving(true)
    setError('')
    try {
      await api.post('/ledger/entries', {
        entry_type: entryType,
        amount,
        category_id: Number(categoryId),
        occurred_at: `${occurredOn}T12:00:00`,
        note: note.trim() || null,
      })
      setAmount('')
      setNote('')
      await loadLedger()
    } catch (err) {
      setError(getErrorMessage(err, '记账失败，请检查金额和分类。'))
    } finally {
      setSaving(false)
    }
  }

  const handleCreateCategory = async () => {
    const name = newCategoryName.trim()
    if (!name) return
    setSaving(true)
    setError('')
    try {
      const response = await api.post<LedgerCategory>('/ledger/categories', {
        name,
        entry_type: entryType,
      })
      setNewCategoryName('')
      await loadLedger()
      setCategoryId(String(response.data.id))
    } catch (err) {
      setError(getErrorMessage(err, '新增分类失败。'))
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteEntry = async (entryId: number) => {
    if (!window.confirm('确定删除这笔账目吗？删除后可通过接口恢复。')) return
    try {
      await api.delete(`/ledger/entries/${entryId}`)
      await loadLedger()
    } catch (err) {
      setError(getErrorMessage(err, '删除账目失败。'))
    }
  }

  const changeMonth = (step: number) => {
    const next = new Date(year, month - 1 + step, 1)
    setYear(next.getFullYear())
    setMonth(next.getMonth() + 1)
  }

  if (authLoading || !user) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#f2f0e9] dark:bg-darkBg">
        <Loader2 className="h-7 w-7 animate-spin text-[#1d6347] dark:text-[#f7b84b]" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f2f0e9] text-[#17211d] dark:bg-darkBg dark:text-foreground">
      <header className="sticky top-0 z-20 border-b border-[#17211d]/10 bg-[#f2f0e9]/88 backdrop-blur-md dark:border-darkBorder dark:bg-darkBg/88">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 md:px-8">
          <BackLink href="/dashboard" label="返回工作台" />
          <div className="flex items-center gap-2 font-display text-lg font-bold">
            <WalletCards size={20} className="text-[#1d6347] dark:text-[#f7b84b]" />
            私人账本
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 pb-20 pt-8 md:px-8">
        <section className="overflow-hidden rounded-[2rem] bg-[#163a2b] p-7 text-white shadow-[0_30px_80px_-50px_rgba(22,58,43,0.9)] md:p-9">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#f7b84b]">Personal ledger</p>
              <h1 className="mt-3 font-display text-3xl font-bold md:text-4xl">每一笔，都只属于你</h1>
              <p className="mt-3 text-sm leading-7 text-white/60">按账号严格隔离，当前仅支持人民币收入与支出。</p>
            </div>
            <div className="inline-flex items-center gap-3 rounded-2xl border border-white/12 bg-white/[0.07] p-2">
              <button onClick={() => changeMonth(-1)} className="rounded-xl px-3 py-2 text-sm hover:bg-white/10" aria-label="上个月">‹</button>
              <span className="min-w-28 text-center text-sm font-bold">{year} 年 {month} 月</span>
              <button onClick={() => changeMonth(1)} className="rounded-xl px-3 py-2 text-sm hover:bg-white/10" aria-label="下个月">›</button>
            </div>
          </div>
        </section>

        {error && (
          <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
            {error}
          </div>
        )}

        <section className="mt-6 grid gap-4 sm:grid-cols-3">
          <SummaryCard label="本月收入" value={summary?.income_total} icon={ArrowDownRight} tone="income" />
          <SummaryCard label="本月支出" value={summary?.expense_total} icon={ArrowUpRight} tone="expense" />
          <SummaryCard label="本月结余" value={summary?.balance} icon={CircleDollarSign} tone="balance" />
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-[0.82fr_1.18fr]">
          <section className="rounded-[2rem] border border-[#17211d]/10 bg-[#fffdf8] p-6 dark:border-darkBorder dark:bg-darkCard">
            <h2 className="flex items-center gap-2 font-display text-2xl font-bold">
              <Plus size={20} className="text-[#1d6347] dark:text-[#f7b84b]" />
              记一笔
            </h2>
            <form onSubmit={handleCreateEntry} className="mt-6 space-y-4">
              <div className="grid grid-cols-2 gap-2 rounded-2xl bg-[#f2f0e9] p-1.5 dark:bg-black/20">
                {(['expense', 'income'] as EntryType[]).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setEntryType(type)}
                    className={`rounded-xl px-4 py-2.5 text-sm font-bold transition ${entryType === type ? 'bg-[#163a2b] text-white shadow-sm dark:bg-[#f7b84b] dark:text-[#241b0b]' : 'text-[#17211d]/55 dark:text-foreground/55'}`}
                  >
                    {type === 'expense' ? '支出' : '收入'}
                  </button>
                ))}
              </div>

              <label className="block">
                <span className="text-xs font-bold text-[#17211d]/55 dark:text-foreground/55">金额（元）</span>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0.01"
                  step="0.01"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  placeholder="0.00"
                  required
                  className="mt-2 w-full rounded-2xl border border-[#17211d]/12 bg-white px-4 py-3 text-2xl font-bold outline-none focus:border-[#1d6347] dark:border-darkBorder dark:bg-black/20"
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label>
                  <span className="text-xs font-bold text-[#17211d]/55 dark:text-foreground/55">分类</span>
                  <select
                    value={categoryId}
                    onChange={(event) => setCategoryId(event.target.value)}
                    required
                    className="mt-2 w-full rounded-2xl border border-[#17211d]/12 bg-white px-4 py-3 text-sm outline-none focus:border-[#1d6347] dark:border-darkBorder dark:bg-black/20"
                  >
                    {activeCategories.map((category) => (
                      <option key={category.id} value={category.id}>{category.name}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className="text-xs font-bold text-[#17211d]/55 dark:text-foreground/55">日期</span>
                  <input
                    type="date"
                    value={occurredOn}
                    onChange={(event) => setOccurredOn(event.target.value)}
                    required
                    className="mt-2 w-full rounded-2xl border border-[#17211d]/12 bg-white px-4 py-3 text-sm outline-none focus:border-[#1d6347] dark:border-darkBorder dark:bg-black/20"
                  />
                </label>
              </div>

              <label className="block">
                <span className="text-xs font-bold text-[#17211d]/55 dark:text-foreground/55">备注（可选）</span>
                <input
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  maxLength={500}
                  placeholder="例如：和朋友吃午饭"
                  className="mt-2 w-full rounded-2xl border border-[#17211d]/12 bg-white px-4 py-3 text-sm outline-none focus:border-[#1d6347] dark:border-darkBorder dark:bg-black/20"
                />
              </label>

              <button
                type="submit"
                disabled={saving || !categoryId}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#1d6347] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#174f3a] disabled:cursor-not-allowed disabled:opacity-50 dark:bg-[#f7b84b] dark:text-[#241b0b]"
              >
                {saving ? <Loader2 size={17} className="animate-spin" /> : <ReceiptText size={17} />}
                保存账目
              </button>
            </form>

            <div className="mt-7 border-t border-[#17211d]/10 pt-5 dark:border-darkBorder">
              <p className="flex items-center gap-2 text-sm font-bold"><Tags size={16} />新增{entryType === 'expense' ? '支出' : '收入'}分类</p>
              <div className="mt-3 flex gap-2">
                <input
                  value={newCategoryName}
                  onChange={(event) => setNewCategoryName(event.target.value)}
                  maxLength={100}
                  placeholder="分类名称"
                  className="min-w-0 flex-1 rounded-2xl border border-[#17211d]/12 bg-white px-4 py-2.5 text-sm outline-none focus:border-[#1d6347] dark:border-darkBorder dark:bg-black/20"
                />
                <button
                  type="button"
                  onClick={handleCreateCategory}
                  disabled={saving || !newCategoryName.trim()}
                  className="rounded-2xl border border-[#1d6347]/30 px-4 py-2.5 text-sm font-bold text-[#1d6347] disabled:opacity-40 dark:border-[#f7b84b]/30 dark:text-[#f7b84b]"
                >
                  新增
                </button>
              </div>
            </div>
          </section>

          <section className="rounded-[2rem] border border-[#17211d]/10 bg-[#fffdf8] p-6 dark:border-darkBorder dark:bg-darkCard">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="font-display text-2xl font-bold">本月明细</h2>
                <p className="mt-1 text-xs text-[#17211d]/45 dark:text-foreground/45">共 {entries.length} 笔</p>
              </div>
              <CalendarDays className="text-[#1d6347] dark:text-[#f7b84b]" />
            </div>

            {loading ? (
              <div className="grid min-h-64 place-items-center"><Loader2 className="animate-spin text-[#1d6347]" /></div>
            ) : entries.length === 0 ? (
              <div className="grid min-h-64 place-items-center rounded-3xl border border-dashed border-[#17211d]/15 text-center text-sm text-[#17211d]/40 dark:border-darkBorder dark:text-foreground/40">
                这个月还没有账目
              </div>
            ) : (
              <div className="mt-5 space-y-3">
                {entries.map((entry) => (
                  <article key={entry.id} className="flex items-center gap-3 rounded-2xl border border-[#17211d]/8 bg-white/60 p-4 dark:border-darkBorder dark:bg-black/10">
                    <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${entry.entry_type === 'income' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'}`}>
                      {entry.entry_type === 'income' ? <ArrowDownRight size={18} /> : <ArrowUpRight size={18} />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold">{entry.category.name}{entry.note ? ` · ${entry.note}` : ''}</p>
                      <p className="mt-1 text-xs text-[#17211d]/42 dark:text-foreground/42">{new Date(entry.occurred_at).toLocaleDateString('zh-CN')}</p>
                    </div>
                    <p className={`shrink-0 font-bold ${entry.entry_type === 'income' ? 'text-emerald-700 dark:text-emerald-300' : ''}`}>
                      {entry.entry_type === 'income' ? '+' : '-'}{money.format(Number(entry.amount))}
                    </p>
                    <button onClick={() => handleDeleteEntry(entry.id)} className="rounded-xl p-2 text-[#17211d]/28 transition hover:bg-red-50 hover:text-red-500 dark:text-foreground/28 dark:hover:bg-red-950/30" aria-label="删除账目">
                      <Trash2 size={16} />
                    </button>
                  </article>
                ))}
              </div>
            )}

            {!!summary?.category_totals.length && (
              <div className="mt-7 border-t border-[#17211d]/10 pt-5 dark:border-darkBorder">
                <h3 className="text-sm font-bold">分类小计</h3>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {summary.category_totals.slice(0, 8).map((item) => (
                    <div key={`${item.entry_type}-${item.category_id}`} className="flex justify-between rounded-xl bg-[#f2f0e9] px-3 py-2 text-xs dark:bg-black/20">
                      <span>{item.category_name}</span>
                      <span className="font-bold">{money.format(Number(item.total))}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  )
}

function SummaryCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string
  value?: string
  icon: typeof ArrowDownRight
  tone: 'income' | 'expense' | 'balance'
}) {
  const colors = {
    income: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
    expense: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
    balance: 'bg-[#e8e7f7] text-[#5b57a6] dark:bg-[#29264d] dark:text-[#b9b4ff]',
  }
  return (
    <div className="rounded-[1.6rem] border border-[#17211d]/10 bg-[#fffdf8] p-5 dark:border-darkBorder dark:bg-darkCard">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-[#17211d]/48 dark:text-foreground/48">{label}</p>
        <span className={`grid h-9 w-9 place-items-center rounded-xl ${colors[tone]}`}><Icon size={17} /></span>
      </div>
      <p className="mt-4 font-display text-2xl font-bold">{money.format(Number(value || 0))}</p>
    </div>
  )
}
