import { readFileSync, writeFileSync, renameSync } from 'node:fs'
import type { Session } from '../shared/types'

export interface SavedTerminal { id: string; name: string; cwd: string }
export function loadTerminals(path: string): SavedTerminal[] | null {
  try {
    const data: unknown = JSON.parse(readFileSync(path, 'utf8'))
    if (!Array.isArray(data) || data.length > 32) return null
    const ids = new Set<string>()
    for (const item of data) {
      if (!item || typeof item.id !== 'string' || !item.id || ids.has(item.id) || typeof item.cwd !== 'string' || !item.cwd || typeof item.name !== 'string' || !item.name.trim() || item.name.length > 120 || /[\x00-\x1f\x7f]/.test(item.name)) return null
      ids.add(item.id)
    }
    return data.map(({ id, name, cwd }) => ({ id, name, cwd }))
  } catch { return null }
}
export function saveTerminals(path: string, sessions: Pick<Session, 'id' | 'name' | 'cwd'>[]): void {
  writeFileSync(`${path}.tmp`, JSON.stringify(sessions.map(({ id, name, cwd }) => ({ id, name, cwd }))), { mode: 0o600 })
  renameSync(`${path}.tmp`, path)
}
