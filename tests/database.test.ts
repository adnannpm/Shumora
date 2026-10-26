import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, it } from 'vitest'
import { openDatabase } from '../src/main/database'
const dirs: string[] = []
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }) })
it('opens a persistent local database without adding application tables or seed data', () => {
  const dir = mkdtempSync(join(tmpdir(), 'shumora-db-')); dirs.push(dir)
  const db = openDatabase(join(dir, 'nested'))
  expect(db.name).toBe(join(dir, 'nested', 'shumora.sqlite'))
  expect(db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all()).toEqual([])
  db.close()
  const reopened = openDatabase(join(dir, 'nested'))
  expect(reopened.pragma('integrity_check', { simple: true })).toBe('ok')
  expect(reopened.prepare("SELECT name FROM sqlite_master WHERE type='table'").all()).toEqual([])
  reopened.close()
})
