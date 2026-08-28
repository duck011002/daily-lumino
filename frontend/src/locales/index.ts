import { zh, LocaleDictionary } from './zh'
import { en } from './en'

export type Locale = 'zh' | 'en'

export const dictionaries: Record<Locale, LocaleDictionary> = {
  zh,
  en,
}

export type { LocaleDictionary }
