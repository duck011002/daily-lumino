export type MediaCategory = 'book' | 'movie' | 'music' | 'status' | 'other'

export interface SiteProfileLink {
  id: string
  label: string
  url: string
  is_public: boolean
  sort_order: number
}

export interface SiteMediaCard {
  id: string
  category: MediaCategory
  title: string
  subtitle: string | null
  creator: string | null
  year: string | null
  badge: string | null
  note: string | null
  image_url: string | null
  url: string | null
  is_public: boolean
  sort_order: number
}

export interface SiteProfile {
  display_name: string
  headline: string
  bio: string
  avatar_url: string | null
  cover_url: string | null
  interest_tags: string[]
  github_url: string | null
  email: string | null
  show_email: boolean
  status_text: string | null
  status_public: boolean
  links: SiteProfileLink[]
  media_cards: SiteMediaCard[]
}

export const defaultSiteProfile: SiteProfile = {
  display_name: 'Lumino',
  headline: '开发者，也在认真收藏生活',
  bio: '这里是我的个人数字庭院：记录技术实践，也保存阅读、影像与日常片段。',
  avatar_url: null,
  cover_url: null,
  interest_tags: ['技术实践', '阅读', '生活记录'],
  github_url: null,
  email: null,
  show_email: true,
  status_text: null,
  status_public: true,
  links: [],
  media_cards: [],
}
