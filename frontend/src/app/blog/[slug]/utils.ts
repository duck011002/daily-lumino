export interface UserResponse {
  username: string
  display_name: string | null
  is_root?: boolean
}

export interface BlogAdjacentPost {
  id: number
  title: string
  slug: string
  cover_url: string | null
  published_at: string | null
}

export interface BlogPost {
  id?: number
  title: string
  slug: string
  content: string
  cover_url: string | null
  excerpt: string | null
  tags: string[] | null
  view_count: number
  published_at: string | null
  updated_at?: string | null
  author: UserResponse | null
  prev_post?: BlogAdjacentPost | null
  next_post?: BlogAdjacentPost | null
}

export interface TocItem {
  id: string
  text: string
  level: number
}

export function extractTocHeadings(content: string): TocItem[] {
  if (!content) return []
  const lines = content.split('\n')
  const items: TocItem[] = []
  let inCodeBlock = false
  const idCounts = new Map<string, number>()

  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.startsWith('```')) {
      inCodeBlock = !inCodeBlock
      continue
    }
    if (inCodeBlock) continue

    const match = trimmed.match(/^(#{1,4})\s+(.+)$/)
    if (match) {
      const level = match[1].length
      let rawText = match[2].trim()
      // Remove inline links [text](url) -> text
      rawText = rawText.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      // Remove bold/italic/code formatting
      rawText = rawText.replace(/[*_~`]/g, '')
      if (!rawText) continue

      // Generate a URL-friendly slug ID for the heading
      let slugId = rawText
        .toLowerCase()
        .replace(/[^\w\u4e00-\u9fa5\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-')

      if (!slugId) {
        slugId = `section-${items.length + 1}`
      }

      const count = idCounts.get(slugId) || 0
      idCounts.set(slugId, count + 1)
      const finalId = count === 0 ? slugId : `${slugId}-${count}`

      items.push({
        id: finalId,
        text: rawText,
        level,
      })
    }
  }
  return items
}

export const getEnhancedAlt = (url: string | null, title?: string) => {
  if (!url) return title ? `${title} - 文章配图` : 'Lumino 技术博文配图'
  if (url.includes('6a90081e86845')) return 'Firecrawl 与 Playwright 爬取高校导师知识图谱系统架构图'
  if (url.includes('6a72f083a38f7')) return 'Lumino 平台全栈架构与双 MCP 设计全景图'
  if (url.includes('6a6c149849681')) return 'Codex 学术论文工作流与保版式翻译演示'
  if (url.includes('6a6c1283271d3')) return 'FRP 持久化运行与公网 SSH 隧道配置图'
  return title ? `${title} - 文章配图` : 'Lumino 技术博文配图'
}
