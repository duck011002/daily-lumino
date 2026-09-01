export interface UserResponse {
  username: string
  display_name: string | null
  is_root?: boolean
}

export interface BlogPost {
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
}

export const getEnhancedAlt = (url: string | null, title?: string) => {
  if (!url) return title ? `${title} - 文章配图` : 'Lumino 技术博文配图'
  if (url.includes('6a90081e86845')) return 'Firecrawl 与 Playwright 爬取高校导师知识图谱系统架构图'
  if (url.includes('6a72f083a38f7')) return 'Lumino 平台全栈架构与双 MCP 设计全景图'
  if (url.includes('6a6c149849681')) return 'Codex 学术论文工作流与保版式翻译演示'
  if (url.includes('6a6c1283271d3')) return 'FRP 持久化运行与公网 SSH 隧道配置图'
  return title ? `${title} - 文章配图` : 'Lumino 技术博文配图'
}
