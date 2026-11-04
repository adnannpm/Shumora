import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
export type AppTheme = 'light' | 'dark' | 'auto'
const AppearanceContext = createContext<{ theme: AppTheme; setTheme: (theme: AppTheme) => void } | null>(null)
export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<AppTheme>(() => {
    try {
      const saved = window.localStorage.getItem('shumora.theme')
      return saved === 'dark' || saved === 'auto' ? saved : 'light'
    } catch { return 'light' }
  })
  useEffect(() => {
    const root = document.documentElement
    const media = theme === 'auto' ? window.matchMedia('(prefers-color-scheme: dark)') : null
    let nativeDark: boolean | undefined
    let alive = true, changed = false
    const applyTheme = () => {
      const resolved = theme === 'auto' ? ((nativeDark ?? media?.matches) ? 'dark' : 'light') : theme
      root.classList.toggle('dark', resolved === 'dark'); root.classList.toggle('light', resolved === 'light')
      root.style.colorScheme = resolved
    }
    applyTheme()
    media?.addEventListener('change', applyTheme)
    const native = theme === 'auto' ? window.appearance : undefined
    const unsubscribe = native?.onSystemTheme(dark => {
      if (!alive) return
      changed = true; nativeDark = dark; applyTheme()
    })
    void native?.systemDark().then(dark => {
      if (alive && !changed) { nativeDark = dark; applyTheme() }
    }).catch(() => { /* Media query remains the fallback for older bridges. */ })
    try { window.localStorage.setItem('shumora.theme', theme) } catch { /* Theme remains usable if storage is unavailable. */ }
    return () => { alive = false; unsubscribe?.(); media?.removeEventListener('change', applyTheme) }
  }, [theme])
  return <AppearanceContext.Provider value={{ theme, setTheme }}>{children}</AppearanceContext.Provider>
}
export function useAppearance() {
  const value = useContext(AppearanceContext)
  if (!value) throw new Error('AppearanceProvider is required')
  return value
}
