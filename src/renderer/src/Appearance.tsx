import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { loadThemes, saveThemes, themeColorKeys, type LocalTheme } from './local-themes'
export type AppTheme = 'light' | 'dark' | 'auto'
type Appearance = { theme: AppTheme; setTheme: (theme: AppTheme) => void; useBuiltInTheme: () => void; localThemes: LocalTheme[]; activeLocalTheme: string | null; installTheme: (theme: LocalTheme) => void; removeTheme: (id: string) => void; selectLocalTheme: (id: string) => void }
const AppearanceContext = createContext<Appearance | null>(null)
export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [theme, setBaseTheme] = useState<AppTheme>(() => {
    try { const saved = window.localStorage.getItem('shumora.theme'); return saved === 'dark' || saved === 'auto' ? saved : 'light' } catch { return 'light' }
  })
  const [localThemes, setLocalThemes] = useState(loadThemes)
  const [activeLocalTheme, setActiveLocalTheme] = useState<string | null>(() => {
    try { return localStorage.getItem('shumora.active-local-theme') } catch { return null }
  })
  const selected = localThemes.find(item => item.id === activeLocalTheme)
  function setTheme(value: AppTheme) { setActiveLocalTheme(null); setBaseTheme(value) }
  function useBuiltInTheme() { setActiveLocalTheme(null) }
  function installTheme(value: LocalTheme) {
    const next = [...localThemes.filter(item => item.id !== value.id), value]
    saveThemes(next)
    setLocalThemes(next)
  }
  function removeTheme(id: string) {
    const next = localThemes.filter(item => item.id !== id)
    saveThemes(next)
    setLocalThemes(next)
    if (activeLocalTheme === id) setActiveLocalTheme(null)
  }
  function selectLocalTheme(id: string) {
    if (!localThemes.some(item => item.id === id)) throw new Error('Theme is not installed.')
    setActiveLocalTheme(id)
  }
  useEffect(() => {
    try { window.localStorage.setItem('shumora.active-local-theme', selected?.id ?? '') } catch { /* Theme remains usable without storage. */ }
  }, [selected?.id])
  useEffect(() => {
    const root = document.documentElement
    const media = theme === 'auto' && !selected ? window.matchMedia('(prefers-color-scheme: dark)') : null
    let nativeDark: boolean | undefined
    let alive = true, changed = false
    const applyTheme = () => {
      const resolved = selected?.mode ?? (theme === 'auto' ? ((nativeDark ?? media?.matches) ? 'dark' : 'light') : theme)
      root.classList.toggle('dark', resolved === 'dark'); root.classList.toggle('light', resolved === 'light')
      root.style.colorScheme = resolved
      for (const key of themeColorKeys) {
        if (selected) root.style.setProperty(`--${key}`, selected.colors[key])
        else root.style.removeProperty(`--${key}`)
      }
    }
    applyTheme()
    media?.addEventListener('change', applyTheme)
    const native = theme === 'auto' && !selected ? window.appearance : undefined
    const unsubscribe = native?.onSystemTheme(dark => { if (!alive) return; changed = true; nativeDark = dark; applyTheme() })
    void native?.systemDark().then(dark => { if (alive && !changed) { nativeDark = dark; applyTheme() } }).catch(() => { /* Media query remains the fallback. */ })
    try { window.localStorage.setItem('shumora.theme', theme) } catch { /* Theme remains usable without storage. */ }
    return () => { alive = false; unsubscribe?.(); media?.removeEventListener('change', applyTheme) }
  }, [theme, selected])
  return <AppearanceContext.Provider value={{ theme, setTheme, useBuiltInTheme, localThemes, activeLocalTheme: selected?.id ?? null, installTheme, removeTheme, selectLocalTheme }}>{children}</AppearanceContext.Provider>
}
export function useAppearance() {
  const value = useContext(AppearanceContext)
  if (!value) throw new Error('AppearanceProvider is required')
  return value
}
