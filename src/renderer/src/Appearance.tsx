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
    const applyTheme = () => {
      const resolved = theme === 'auto' ? (media?.matches ? 'dark' : 'light') : theme
      root.classList.toggle('dark', resolved === 'dark'); root.classList.toggle('light', resolved === 'light')
      root.style.colorScheme = resolved
    }
    applyTheme()
    media?.addEventListener('change', applyTheme)
    try { window.localStorage.setItem('shumora.theme', theme) } catch { /* Theme remains usable if storage is unavailable. */ }
    return () => media?.removeEventListener('change', applyTheme)
  }, [theme])
  return <AppearanceContext.Provider value={{ theme, setTheme }}>{children}</AppearanceContext.Provider>
}
export function useAppearance() {
  const value = useContext(AppearanceContext)
  if (!value) throw new Error('AppearanceProvider is required')
  return value
}
