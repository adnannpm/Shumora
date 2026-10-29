import { afterEach, expect, it } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadTerminals, saveTerminals } from '../src/main/workspace-state'
import { SessionManager } from '../src/main/sessions'
const dirs: string[] = []
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }) })
function file() { const dir = mkdtempSync(join(tmpdir(), 'shumora-workspace-')); dirs.push(dir); return join(dir, 'terminals.json') }
it('restores five named terminals in their original folders with stable identities and fresh processes', () => {
  const path = file()
  const spawn = () => ({ onData: () => ({ dispose() {} }), onExit: () => ({ dispose() {} }), write() {}, resize() {}, kill() {} })
  const original = new SessionManager(spawn, () => {})
  for (const cwd of ['/b', '/e', '/c', '/c', '/c']) original.create(cwd)
  original.rename(original.list()[0].id, 'Backend')
  saveTerminals(path, original.list())
  original.dispose()
  const restored = new SessionManager(spawn, () => {})
  for (const terminal of loadTerminals(path)!) restored.create(terminal.cwd, terminal)
  expect(restored.list().map(({ id, name, cwd }) => ({ id, name, cwd }))).toEqual(loadTerminals(path))
  expect(restored.list().every(s => s.status === 'running')).toBe(true)
  restored.close(restored.list()[0].id)
  saveTerminals(path, restored.list())
  expect(loadTerminals(path)).toHaveLength(4)
})
it('distinguishes an intentionally empty workspace from missing or corrupt state', () => {
  const path = file()
  expect(loadTerminals(path)).toBeNull()
  writeFileSync(path, '{broken')
  expect(loadTerminals(path)).toBeNull()
  saveTerminals(path, [])
  expect(loadTerminals(path)).toEqual([])
  writeFileSync(path, JSON.stringify([{ id: 'a', name: 'A', cwd: '/b' }, { id: 'a', name: 'B', cwd: '/c' }]))
  expect(loadTerminals(path)).toBeNull()
})
it('keeps a restored tab when its process cannot start', () => {
  const manager = new SessionManager(() => { throw new Error('Folder missing') }, () => {})
  expect(manager.create('/missing', { id: 'saved', name: 'Saved tab' })).toMatchObject({ id: 'saved', name: 'Saved tab', cwd: '/missing', status: 'error', error: 'Folder missing' })
})
