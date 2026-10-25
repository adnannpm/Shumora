import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
export type AppTheme = 'light' | 'dark'
const AppearanceContext = createContext<{ theme: AppTheme; setTheme: (theme: AppTheme) => void } | null>(null)
export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<AppTheme>(() => {
    try { return window.localStorage.getItem('shumora.theme') === 'dark' ? 'dark' : 'light' } catch { return 'light' }
  })
  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', theme === 'dark'); root.classList.toggle('light', theme === 'light')
    root.style.colorScheme = theme
    try { window.localStorage.setItem('shumora.theme', theme) } catch { /* Theme remains usable if storage is unavailable. */ }
  }, [theme])
  return <AppearanceContext.Provider value={{ theme, setTheme }}>{children}</AppearanceContext.Provider>
}
export function useAppearance() {
  const value = useContext(AppearanceContext)
  if (!value) throw new Error('AppearanceProvider is required')
  return value
}
