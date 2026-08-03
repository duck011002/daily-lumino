import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

interface BackLinkProps {
  href: string
  label: string
  className?: string
  onClick?: () => void
}

export default function BackLink({ href, label, className = '', onClick }: BackLinkProps) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`group inline-flex min-h-10 items-center gap-2 rounded-xl border border-primary/20 bg-primary/[0.06] px-3 text-sm font-bold text-primary shadow-sm transition hover:-translate-x-0.5 hover:border-primary/45 hover:bg-primary hover:text-white focus:outline-none focus:ring-2 focus:ring-primary/40 focus:ring-offset-2 dark:bg-primary/10 dark:focus:ring-offset-darkBg ${className}`}
    >
      <ArrowLeft size={17} className="transition-transform group-hover:-translate-x-0.5" />
      <span>{label}</span>
    </Link>
  )
}
