'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowRight,
  FolderHeart,
  HeartPulse,
  Images,
  Loader2,
  LockKeyhole,
  MessagesSquare,
  NotebookPen,
  Sparkles,
} from 'lucide-react'
import SiteNav from '@/components/layout/SiteNav'
import { useAuth } from '@/hooks/useAuth'

const capabilities = [
  {
    icon: MessagesSquare,
    title: 'AI 对话',
    description: '在自己的账号下保存对话与使用习惯，公共访客不会看到任何聊天内容。',
  },
  {
    icon: FolderHeart,
    title: '私密空间',
    description: '情侣、家庭与挚友空间按成员权限隔离，只向被邀请的账号开放。',
  },
  {
    icon: Images,
    title: '时光相册',
    description: '把照片收进所属空间，和重要的人共同整理真实生活的片段。',
  },
  {
    icon: NotebookPen,
    title: '协同笔记',
    description: '使用 Markdown 共同记录计划、纪念日与需要长期保存的文字。',
  },
  {
    icon: HeartPulse,
    title: '健康记录',
    description: '记录饮食、运动与个人健康节奏，仅本人和被授权账号可以访问。',
  },
]

export default function CourtyardPorch() {
  const router = useRouter()
  const { user, loading } = useAuth()

  useEffect(() => {
    if (!loading && user) router.replace('/dashboard')
  }, [loading, router, user])

  if (loading || user) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#f8f6f0] dark:bg-darkBg">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#b56b19]" />
          <p className="mt-3 text-sm text-[#17211d]/50 dark:text-foreground/50">
            {user ? '正在为你打开内院…' : '正在确认来访身份…'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f2f0e9] text-[#17211d] dark:bg-darkBg dark:text-foreground">
      <SiteNav />
      <main className="mx-auto max-w-7xl px-5 pb-20 pt-8 md:px-8 md:pt-12">
        <section className="relative overflow-hidden rounded-[2.4rem] bg-[#163a2b] px-7 py-14 text-white shadow-[0_35px_100px_-55px_rgba(22,58,43,0.95)] md:px-12 md:py-20">
          <div className="absolute -right-28 -top-28 h-96 w-96 rounded-full border-[54px] border-[#f7b84b]/14" />
          <div className="absolute -bottom-32 left-1/4 h-64 w-[36rem] rounded-full bg-[#f7b84b]/10 blur-3xl" />
          <div className="relative max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/8 px-3 py-1.5 text-xs font-semibold text-white/72">
              <LockKeyhole size={13} className="text-[#f7b84b]" />
              Private courtyard · 游客门廊
            </div>
            <h1 className="mt-6 font-display text-4xl font-bold leading-tight md:text-6xl">
              门廊向你开放，
              <br />
              内院只留给被邀请的人。
            </h1>
            <p className="mt-6 max-w-2xl text-sm leading-7 text-white/66 md:text-base">
              这里介绍 Lumino 登录后可以使用的私人能力，但不会展示任何真实空间、照片、笔记、健康记录或 AI 对话。
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/login"
                className="inline-flex items-center gap-2 rounded-full bg-[#f7b84b] px-5 py-3 text-sm font-bold text-[#17211d] transition hover:bg-[#ffc963]"
              >
                登录并进入内院
                <ArrowRight size={16} />
              </Link>
              <Link
                href="/register"
                className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/8 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/14"
              >
                使用邀请码注册
              </Link>
            </div>
          </div>
        </section>

        <section className="mt-12">
          <div className="flex flex-col gap-3 border-b border-[#17211d]/10 pb-5 dark:border-darkBorder md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#b56b19]">
                Inside the courtyard
              </p>
              <h2 className="mt-2 font-display text-3xl font-bold">内院里有什么</h2>
            </div>
            <p className="text-sm text-[#17211d]/48 dark:text-foreground/48">
              所有真实数据都遵循账号与空间成员权限。
            </p>
          </div>

          <div className="mt-6 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {capabilities.map((item, index) => (
              <div
                key={item.title}
                className={`rounded-[1.8rem] border border-[#17211d]/10 bg-[#fffdf8] p-7 dark:border-darkBorder dark:bg-darkCard ${
                  index === capabilities.length - 1 ? 'md:col-span-2 lg:col-span-1' : ''
                }`}
              >
                <div className="flex items-start justify-between">
                  <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#e7efe8] text-[#1d6347] dark:bg-[#163a2b] dark:text-[#f7b84b]">
                    <item.icon size={22} />
                  </span>
                  <span className="rounded-full bg-[#f1eee5] px-2.5 py-1 text-[10px] font-bold text-[#17211d]/45 dark:bg-darkBg dark:text-foreground/45">
                    需登录
                  </span>
                </div>
                <h3 className="mt-6 font-display text-xl font-bold">{item.title}</h3>
                <p className="mt-3 text-sm leading-7 text-[#17211d]/58 dark:text-foreground/58">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-12 rounded-[2rem] border border-[#b56b19]/18 bg-[#fbf1df] px-7 py-8 dark:border-[#f7b84b]/15 dark:bg-[#2e2518] md:flex md:items-center md:justify-between">
          <div>
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.17em] text-[#b56b19] dark:text-[#f7b84b]">
              <Sparkles size={14} />
              Privacy first
            </p>
            <h2 className="mt-3 font-display text-2xl font-bold">公开介绍与私密数据严格分开</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#17211d]/58 dark:text-foreground/58">
              前厅、书房和博客永远不会自动读取内院内容。只有登录并通过权限校验后，系统才会加载属于当前账号的私人数据。
            </p>
          </div>
          <Link
            href="/"
            className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-[#1d6347] dark:text-[#f7b84b] md:mt-0"
          >
            返回前厅
            <ArrowRight size={15} />
          </Link>
        </section>
      </main>
    </div>
  )
}
