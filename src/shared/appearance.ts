export interface AppearanceAPI {
  systemDark(): Promise<boolean>
  onSystemTheme(callback: (dark: boolean) => void): () => void
}
declare global { interface Window { appearance?: AppearanceAPI } }
