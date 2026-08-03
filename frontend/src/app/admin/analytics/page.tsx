'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Activity,
  BarChart3,
  Clock3,
  Eye,
  Globe2,
  Laptop2,
  MapPin,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  TrendingUp,
  Users,
} from 'lucide-react'
import api, { getErrorMessage } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import BackLink from '@/components/ui/BackLink'
import ThemeToggle from '@/components/layout/ThemeToggle'

interface Overview {
  today_views: number
  today_unique_visitors: number
  period_views: number
  average_daily_unique_visitors: number
}

interface TrendItem {
  date: string
  page_views: number
  unique_visitors: number
}

interface DimensionItem {
  value: string
  page_views: number
  unique_visitors: number
}

interface RecentVisit {
  visited_at: string
  ip_address: string
  path: string
  country_code: string
  subdivision_code: string
  city_name: string
  isp_code: string
  device_type: string
  referrer_host: string | null
}

interface AnalyticsResponse {
  generated_at: string
  period_days: number
  overview: Overview
  trend: TrendItem[]
  breakdowns: Record<string, DimensionItem[]>
  recent_visits: RecentVisit[]
  retention: { raw_hours: number; summary_days: number }
}

const PROVINCE_NAMES: Record<string, string> = {
  'CN-AH': '安徽', 'CN-BJ': '北京', 'CN-CQ': '重庆', 'CN-FJ': '福建', 'CN-GD': '广东',
  'CN-GS': '甘肃', 'CN-GX': '广西', 'CN-GZ': '贵州', 'CN-HA': '河南', 'CN-HB': '湖北',
  'CN-HE': '河北', 'CN-HI': '海南', 'CN-HK': '香港', 'CN-HL': '黑龙江', 'CN-HN': '湖南',
  'CN-JL': '吉林', 'CN-JS': '江苏', 'CN-JX': '江西', 'CN-LN': '辽宁', 'CN-MO': '澳门',
  'CN-NM': '内蒙古', 'CN-NX': '宁夏', 'CN-QH': '青海', 'CN-SC': '四川', 'CN-SD': '山东',
  'CN-SH': '上海', 'CN-SN': '陕西', 'CN-SX': '山西', 'CN-TJ': '天津', 'CN-TW': '台湾',
  'CN-XJ': '新疆', 'CN-XZ': '西藏', 'CN-YN': '云南', 'CN-ZJ': '浙江',
}

const ISP_NAMES: Record<string, string> = {
  '100017': '中国电信', '100025': '中国移动', '100026': '中国联通', '100016': '中国网通',
  '100020': '中国铁通', '100061': '长城宽带', '100027': '教育网', '1000139': '广电网',
  '100080': '歌华', '1000143': '鹏博士', '100098': '阿里巴巴', '1000323': '阿里云',
  '1000401': '腾讯', '100099': '百度', '100093': '网宿',
}

const DEVICE_NAMES: Record<string, string> = {
  desktop: '桌面设备', mobile: '移动设备', tablet: '平板设备', unknown: '未识别设备',
}

const countryDisplay = typeof Intl !== 'undefined'
  ? new Intl.DisplayNames(['zh-CN'], { type: 'region' })
  : null

const formatCountry = (code: string) => {
  if (!code || code === 'XX') return '未识别地区'
  try { return countryDisplay?.of(code.toUpperCase()) || code }
  catch { return code }
}

const formatPath = (path: string) => {
  if (path === '/') return '前厅'
  if (path === '/library') return '书房'
  if (path === '/blog') return '博客首页'
  if (path.startsWith('/blog/')) return `文章 · ${decodeURIComponent(path.slice(6))}`
  return path
}

const formatDimension = (type: string, value: string) => {
  if (type === 'path') return formatPath(value)
  if (type === 'country') return formatCountry(value)
  if (type === 'subdivision') return PROVINCE_NAMES[value] || (value === 'XX' ? '未识别省份' : value)
  if (type === 'city') return value === 'XX' ? '未识别城市' : value
  if (type === 'isp') return ISP_NAMES[value] || (value === 'XX' ? '未识别运营商' : value)
  if (type === 'device') return DEVICE_NAMES[value] || value
  if (type === 'referrer') return value === 'direct' ? '直接访问' : value
  return value
}

const formatServerTime = (value: string) => {
  const withZone = /([zZ]|[+-]\d{2}:\d{2})$/.test(value) ? value : `${value}+08:00`
  return new Date(withZone).toLocaleString('zh-CN', { hour12: false })
}

function MetricCard({ label, value, note, icon: Icon }: {
  label: string
  value: number
  note: string
  icon: typeof Eye
}) {
  return (
    <div className="rounded-3xl border border-stone-200/90 bg-white/85 p-5 shadow-[0_18px_45px_-34px_rgba(28,52,42,0.55)] dark:border-stone-700 dark:bg-stone-900/85">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold tracking-[0.12em] text-stone-500 dark:text-stone-400">{label}</p>
        <span className="rounded-2xl bg-emerald-950 p-2.5 text-amber-400 dark:bg-emerald-900"><Icon size={18} /></span>
      </div>
      <p className="mt-5 font-display text-4xl font-bold text-emerald-950 dark:text-stone-50">{value.toLocaleString()}</p>
      <p className="mt-2 text-xs text-stone-500 dark:text-stone-400">{note}</p>
    </div>
  )
}

function RankingCard({ title, type, items, icon: Icon }: {
  title: string
  type: string
  items: DimensionItem[]
  icon: typeof Globe2
}) {
  const maxViews = Math.max(...items.map((item) => item.page_views), 1)
  return (
    <section className="rounded-3xl border border-stone-200/90 bg-white/80 p-5 dark:border-stone-700 dark:bg-stone-900/80">
      <div className="mb-5 flex items-center gap-2 text-emerald-950 dark:text-stone-100">
        <Icon size={18} className="text-amber-600 dark:text-amber-400" />
        <h2 className="font-bold">{title}</h2>
      </div>
      {items.length === 0 ? (
        <p className="py-10 text-center text-sm text-stone-400">等待积累访问数据</p>
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <div key={item.value}>
              <div className="mb-1.5 flex items-center justify-between gap-4 text-sm">
                <span className="min-w-0 truncate font-medium text-stone-800 dark:text-stone-200" title={item.value}>
                  {formatDimension(type, item.value)}
                </span>
                <span className="shrink-0 text-xs tabular-nums text-stone-500">{item.page_views} 次</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-stone-100 dark:bg-stone-800">
                <div className="h-full rounded-full bg-gradient-to-r from-emerald-800 to-amber-500" style={{ width: `${Math.max((item.page_views / maxViews) * 100, 5)}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

export default function VisitAnalyticsPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [periodDays, setPeriodDays] = useState(30)
  const [data, setData] = useState<AnalyticsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadAnalytics = async (days = periodDays) => {
    setLoading(true)
    setError('')
    try {
      const response = await api.get<AnalyticsResponse>('/admin/analytics', { params: { days } })
      setData(response.data)
    } catch (requestError) {
      setError(getErrorMessage(requestError, '读取访问洞察失败。'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (authLoading) return
    if (!user?.is_root) {
      router.replace('/dashboard')
      return
    }
    void loadAnalytics(periodDays)
  }, [authLoading, periodDays, router, user])

  const trendMax = useMemo(
    () => Math.max(...(data?.trend.map((item) => item.page_views) || []), 1),
    [data]
  )

  if (authLoading || (loading && !data)) {
    return <div className="flex min-h-screen items-center justify-center bg-[#f3f0e8] dark:bg-stone-950"><RefreshCw className="animate-spin text-emerald-800" /></div>
  }

  if (!user?.is_root) return null

  return (
    <div className="min-h-screen bg-[#f3f0e8] text-stone-900 transition-colors dark:bg-stone-950 dark:text-stone-100">
      <header className="sticky top-0 z-20 border-b border-stone-200/80 bg-[#f3f0e8]/90 backdrop-blur-xl dark:border-stone-800 dark:bg-stone-950/90">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 lg:px-8">
          <div className="flex items-center gap-3">
            <BackLink href="/admin" label="返回系统后台" />
            <span className="hidden h-5 w-px bg-stone-300 sm:block dark:bg-stone-700" />
            <span className="hidden items-center gap-2 font-display font-bold text-emerald-950 sm:flex dark:text-stone-100"><BarChart3 size={18} />访问洞察</span>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 py-8 lg:px-8 lg:py-10">
        <section className="overflow-hidden rounded-[2rem] bg-emerald-950 px-6 py-7 text-white shadow-[0_28px_70px_-42px_rgba(10,45,31,0.85)] sm:px-8">
          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold tracking-[0.18em] text-amber-400"><Activity size={16} /> VISITOR INSIGHTS</div>
              <h1 className="mt-3 font-display text-3xl font-bold sm:text-4xl">看见庭院里的来访足迹</h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-white/65">只记录公开页面访问。查询参数、Cookie、完整浏览器信息和后台私密页面均不会入库。</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-white/15 bg-white/5 px-3 py-2 text-xs text-white/70">明细 {data?.retention.raw_hours || 48} 小时</span>
              <span className="rounded-full border border-white/15 bg-white/5 px-3 py-2 text-xs text-white/70">汇总 {data?.retention.summary_days || 180} 天</span>
              <button onClick={() => void loadAnalytics()} disabled={loading} className="flex items-center gap-2 rounded-full bg-amber-400 px-4 py-2 text-xs font-bold text-emerald-950 transition hover:bg-amber-300 disabled:opacity-60"><RefreshCw size={14} className={loading ? 'animate-spin' : ''} />刷新</button>
            </div>
          </div>
        </section>

        {error && <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">{error}</div>}

        <div className="mt-7 flex items-center justify-between gap-4">
          <p className="text-sm text-stone-500 dark:text-stone-400">统计范围</p>
          <div className="flex rounded-full border border-stone-200 bg-white p-1 dark:border-stone-700 dark:bg-stone-900">
            {[7, 30, 90].map((days) => <button key={days} onClick={() => setPeriodDays(days)} className={`rounded-full px-4 py-1.5 text-xs font-bold transition ${periodDays === days ? 'bg-emerald-950 text-white dark:bg-emerald-800' : 'text-stone-500 hover:text-emerald-800 dark:text-stone-400'}`}>{days} 天</button>)}
          </div>
        </div>

        {data && (
          <>
            <section className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard label="今日浏览" value={data.overview.today_views} note="同一路径每个 IP 半小时内去重" icon={Eye} />
              <MetricCard label="今日独立 IP" value={data.overview.today_unique_visitors} note="使用每日不可逆哈希参与汇总" icon={Users} />
              <MetricCard label={`${periodDays} 日浏览`} value={data.overview.period_views} note="公开前厅、书房与博客" icon={TrendingUp} />
              <MetricCard label="日均独立 IP" value={data.overview.average_daily_unique_visitors} note={`最近 ${periodDays} 天的日均值`} icon={Activity} />
            </section>

            <section className="mt-5 rounded-3xl border border-stone-200/90 bg-white/80 p-5 sm:p-7 dark:border-stone-700 dark:bg-stone-900/80">
              <div className="flex items-start justify-between gap-4">
                <div><h2 className="font-display text-xl font-bold text-emerald-950 dark:text-stone-100">访问趋势</h2><p className="mt-1 text-xs text-stone-500">最多展示最近 30 天；深色柱为浏览量，数字为当日独立 IP。</p></div>
                <Clock3 size={20} className="text-amber-600" />
              </div>
              <div className="mt-7 flex h-52 items-end gap-1.5 sm:gap-2" aria-label="访问趋势柱状图">
                {data.trend.map((item, index) => {
                  const height = Math.max((item.page_views / trendMax) * 100, item.page_views ? 5 : 1)
                  const showLabel = data.trend.length <= 14 || index % 3 === 0 || index === data.trend.length - 1
                  return <div key={item.date} className="group flex min-w-0 flex-1 flex-col items-center justify-end gap-2" title={`${item.date}：${item.page_views} 次浏览，${item.unique_visitors} 个独立 IP`}><span className="text-[9px] tabular-nums text-stone-400 opacity-0 transition group-hover:opacity-100">{item.unique_visitors}</span><div className="w-full max-w-8 rounded-t-lg bg-gradient-to-t from-emerald-950 to-emerald-600 transition group-hover:from-amber-600 group-hover:to-amber-400" style={{ height: `${height}%` }} /><span className="h-4 whitespace-nowrap text-[9px] text-stone-400">{showLabel ? item.date.slice(5) : ''}</span></div>
                })}
              </div>
            </section>

            <section className="mt-5 grid gap-5 lg:grid-cols-2 xl:grid-cols-4">
              <RankingCard title="热门页面" type="path" items={data.breakdowns.path || []} icon={TrendingUp} />
              <RankingCard title="国家与地区" type="country" items={data.breakdowns.country || []} icon={Globe2} />
              <RankingCard title="省份分布" type="subdivision" items={data.breakdowns.subdivision || []} icon={MapPin} />
              <RankingCard title="城市分布" type="city" items={data.breakdowns.city || []} icon={MapPin} />
              <RankingCard title="访问来源" type="referrer" items={data.breakdowns.referrer || []} icon={Globe2} />
              <RankingCard title="设备类型" type="device" items={data.breakdowns.device || []} icon={Laptop2} />
              <RankingCard title="运营商" type="isp" items={data.breakdowns.isp || []} icon={Activity} />
            </section>

            <section className="mt-5 overflow-hidden rounded-3xl border border-stone-200/90 bg-white/80 dark:border-stone-700 dark:bg-stone-900/80">
              <div className="flex flex-col justify-between gap-3 border-b border-stone-200 px-5 py-5 sm:flex-row sm:items-center dark:border-stone-700">
                <div><h2 className="font-display text-xl font-bold text-emerald-950 dark:text-stone-100">近期访问明细</h2><p className="mt-1 text-xs text-stone-500">完整 IP 仅在这里保留 {data.retention.raw_hours} 小时，之后只留下匿名汇总。</p></div>
                <span className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400"><ShieldCheck size={15} />仅超级管理员可见</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[980px] text-left text-sm">
                  <thead className="bg-stone-50 text-xs text-stone-500 dark:bg-stone-950/50 dark:text-stone-400"><tr><th className="px-5 py-3">访问时间</th><th className="px-5 py-3">IP 地址</th><th className="px-5 py-3">归属地</th><th className="px-5 py-3">页面</th><th className="px-5 py-3">设备</th><th className="px-5 py-3">来源</th></tr></thead>
                  <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                    {data.recent_visits.length === 0 ? <tr><td colSpan={6} className="px-5 py-16 text-center text-stone-400">部署后等待第一批公开页面访问</td></tr> : data.recent_visits.map((visit, index) => (
                      <tr key={`${visit.visited_at}-${visit.ip_address}-${index}`} className="transition hover:bg-amber-50/45 dark:hover:bg-stone-800/60">
                        <td className="whitespace-nowrap px-5 py-4 text-xs text-stone-500">{formatServerTime(visit.visited_at)}</td>
                        <td className="px-5 py-4 font-mono text-xs font-semibold text-emerald-900 dark:text-emerald-300">{visit.ip_address}</td>
                        <td className="px-5 py-4"><p className="font-medium">{formatCountry(visit.country_code)} · {PROVINCE_NAMES[visit.subdivision_code] || visit.subdivision_code}</p><p className="mt-1 text-xs text-stone-400">{visit.city_name === 'XX' ? '城市未识别' : visit.city_name} · {ISP_NAMES[visit.isp_code] || visit.isp_code}</p></td>
                        <td className="max-w-[260px] truncate px-5 py-4" title={visit.path}>{formatPath(visit.path)}</td>
                        <td className="px-5 py-4"><span className="inline-flex items-center gap-1.5 rounded-full bg-stone-100 px-2.5 py-1 text-xs dark:bg-stone-800">{visit.device_type === 'mobile' ? <Smartphone size={13} /> : <Laptop2 size={13} />}{DEVICE_NAMES[visit.device_type] || visit.device_type}</span></td>
                        <td className="max-w-[180px] truncate px-5 py-4 text-xs text-stone-500" title={visit.referrer_host || ''}>{visit.referrer_host === 'direct' ? '直接访问' : visit.referrer_host}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <p className="mt-5 text-center text-xs leading-6 text-stone-400">IP 地域由 ESA 边缘节点识别，城市级结果及 VPN/代理访问可能存在偏差。最后生成：{formatServerTime(data.generated_at)}</p>
          </>
        )}
      </main>
    </div>
  )
}
