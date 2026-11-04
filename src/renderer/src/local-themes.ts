export const themeColorKeys = ['surface', 'sidebar', 'canvas', 'line', 'muted', 'accent', 'accent-contrast', 'text', 'selected', 'selected-text'] as const
export type ThemeColors = Record<typeof themeColorKeys[number], string>
export interface LocalTheme { format: 'shumora-theme/v1'; id: string; name: string; mode: 'light' | 'dark'; colors: ThemeColors }
const storageKey = 'shumora.local-themes'
const exact = (value: Record<string, unknown>, keys: readonly string[]) => Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key))
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)

export function parseTheme(raw: string): LocalTheme {
  if (raw.length > 65536) throw new Error('Theme file is too large (maximum 64 KB).')
  let value: unknown
  try { value = JSON.parse(raw) } catch { throw new Error('Theme must be valid JSON.') }
  const colors = object(value) ? value.colors : undefined
  if (!object(value) || !exact(value, ['format', 'id', 'name', 'mode', 'colors']) || value.format !== 'shumora-theme/v1' ||
    typeof value.id !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value.id) || value.id.length > 64 ||
    typeof value.name !== 'string' || !value.name.trim() || value.name.length > 80 ||
    (value.mode !== 'light' && value.mode !== 'dark') || !object(colors) || !exact(colors, themeColorKeys) ||
    !themeColorKeys.every(key => typeof colors[key] === 'string' && /^#[0-9a-fA-F]{6}$/.test(colors[key] as string))) {
    throw new Error('Invalid Shumora theme. Use the theme template and hex colors only.')
  }
  return value as unknown as LocalTheme
}
export function loadThemes(): LocalTheme[] {
  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw || raw.length > 1310720) return []
    const values: unknown = JSON.parse(raw)
    if (!Array.isArray(values) || values.length > 20) return []
    const themes = values.map(value => parseTheme(JSON.stringify(value)))
    return new Set(themes.map(theme => theme.id)).size === themes.length ? themes : []
  } catch { return [] }
}
export function saveThemes(themes: LocalTheme[]): void {
  if (themes.length > 20 || new Set(themes.map(theme => theme.id)).size !== themes.length) throw new Error('Theme limit reached or duplicate theme ID.')
  themes.forEach(theme => parseTheme(JSON.stringify(theme)))
  localStorage.setItem(storageKey, JSON.stringify(themes))
}
