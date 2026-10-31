import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { indonesian } from './locales/id'
import { chinese } from './locales/zh'
export type Language = 'en' | 'id' | 'zh'
export function isLanguage(value: unknown): value is Language { return value === 'en' || value === 'id' || value === 'zh' }
type Translate = (text: string, values?: Record<string, string | number>) => string
export function translate(language: Language, text: string, values: Record<string, string | number> = {}) {
  const template = (language === 'id' ? indonesian[text] : language === 'zh' ? chinese[text] : undefined) ?? text
  return template.replace(/\{(\w+)\}/g, (match, key: string) => String(values[key] ?? match))
}
const LanguageContext = createContext<{ language: Language; setLanguage: (language: Language) => void; t: Translate }>({ language: 'en', setLanguage: () => {}, t: (text, values) => translate('en', text, values) })
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(() => {
    try { const saved = window.localStorage.getItem('shumora.language'); return isLanguage(saved) ? saved : 'en' } catch { return 'en' }
  })
  useEffect(() => {
    document.documentElement.lang = language === 'zh' ? 'zh-CN' : language
    try { window.localStorage.setItem('shumora.language', language) } catch { /* Keep language usable without storage. */ }
  }, [language])
  return <LanguageContext.Provider value={{ language, setLanguage, t: (text, values) => translate(language, text, values) }}>{children}</LanguageContext.Provider>
}
export const useLanguage = () => useContext(LanguageContext)
