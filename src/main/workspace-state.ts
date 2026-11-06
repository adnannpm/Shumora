import { readFileSync, writeFileSync, renameSync } from 'node:fs'
import type { Session } from '../shared/types'
import { assertTerminalAgent, type TerminalAgent } from '../shared/terminal-agent'

export interface SavedTerminal {
  id: string
  name: string
  cwd: string
  agent?: TerminalAgent
}

type PersistedSession = Pick<Session, 'id' | 'name' | 'cwd' | 'agent'>

const MAX_SAVED_TERMINALS = 32
const MAX_NAME_LENGTH = 120
const CONTROL_CHAR_PATTERN = /[\x00-\x1f\x7f]/

function isValidTerminalRecord(item: unknown, seenIds: Set<string>): item is Record<string, unknown> & { id: string; name: string; cwd: string } {
  if (!item || typeof item !== 'object') return false
  const record = item as Record<string, unknown>
  if (typeof record.id !== 'string' || !record.id || seenIds.has(record.id)) return false
  if (typeof record.cwd !== 'string' || !record.cwd) return false
  if (typeof record.name !== 'string' || !record.name.trim() || record.name.length > MAX_NAME_LENGTH) return false
  if (CONTROL_CHAR_PATTERN.test(record.name)) return false
  return true
}

function serializeTerminals(sessions: PersistedSession[]): string {
  return JSON.stringify(sessions.map(({ id, name, cwd, agent }) => ({ id, name, cwd, agent })))
}

export function loadTerminals(path: string): SavedTerminal[] | null {
  let data: unknown
  try {
    data = JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return null
  }
  if (!Array.isArray(data) || data.length > MAX_SAVED_TERMINALS) return null

  const seenIds = new Set<string>()
  const terminals: SavedTerminal[] = []

  for (const item of data) {
    if (!isValidTerminalRecord(item, seenIds)) return null
    if (item.agent !== undefined) {
      assertTerminalAgent(item.agent, 'Invalid terminal agent in saved workspace')
    }
    seenIds.add(item.id)
    terminals.push({
      id: item.id,
      name: item.name,
      cwd: item.cwd,
      ...(item.agent === undefined ? {} : { agent: item.agent })
    })
  }

  return terminals
}

// Each app instance owns one writer. Do not delay actual tab metadata changes:
// only skip successful writes whose persisted fields are identical.
export class TerminalStateWriter {
  private previousPath: string | undefined
  private previousData: string | undefined

  constructor(private write: typeof saveTerminals = saveTerminals) {}

  save(path: string, sessions: PersistedSession[]): void {
    const data = serializeTerminals(sessions)
    if (path === this.previousPath && data === this.previousData) return
    this.write(path, sessions)
    this.previousPath = path
    this.previousData = data
  }
}

export function saveTerminals(path: string, sessions: PersistedSession[]): void {
  const tempPath = `${path}.tmp`
  writeFileSync(tempPath, serializeTerminals(sessions), { mode: 0o600 })
  renameSync(tempPath, path)
}
