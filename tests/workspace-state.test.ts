import { afterEach, expect, it, vi } from 'vitest'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadTerminals, saveTerminals, TerminalStateWriter } from '../src/main/workspace-state'
import { SessionManager } from '../src/main/sessions'
const dirs: string[] = []
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }) })
function file() { const dir = mkdtempSync(join(tmpdir(), 'shumora-workspace-')); dirs.push(dir); return join(dir, 'terminals.json') }
it('restores five named terminals in their original folders with stable identities and fresh processes', () => {
  const path = file()
  const spawn = () => ({ onData: () => ({ dispose() {} }), onExit: () => ({ dispose() {} }), write() {}, resize() {}, kill() {} })
  const original = new SessionManager(spawn, () => {})
  for (const cwd of ['/b', '/e', '/c', '/c', '/c']) original.create(cwd, undefined, cwd === '/e' ? 'opencode' : 'pi')
  original.rename(original.list()[0].id, 'Backend')
  saveTerminals(path, original.list())
  original.dispose()
  const restored = new SessionManager(spawn, () => {})
  for (const terminal of loadTerminals(path)!) restored.create(terminal.cwd, terminal, terminal.agent)
  expect(restored.list().map(({ id, name, cwd, agent }) => ({ id, name, cwd, agent }))).toEqual(loadTerminals(path))
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
it('writes metadata changes immediately but skips identical state on stop or restart', () => {
  const write = vi.fn()
  const writer = new TerminalStateWriter(write)
  const session = { id: 'one', name: 'Pi 1', cwd: '/tmp', agent: 'pi' as const, status: 'running' as const }
  writer.save('state.json', [session])
  const stopped = { ...session, status: 'exited' as const }
  writer.save('state.json', [stopped])
  expect(write).toHaveBeenCalledTimes(1)
  writer.save('state.json', [{ ...session, name: 'Renamed' }])
  writer.save('other.json', [{ ...session, name: 'Renamed' }])
  writer.save('other.json', [])
  expect(write).toHaveBeenCalledTimes(4)
})
it('accepts legacy missing programs but rejects explicit invalid programs and persists the resolved identity', () => {
  const path = file()
  const legacy = { id: 'legacy', name: 'Custom', cwd: '/tmp' }
  writeFileSync(path, JSON.stringify([legacy]))
  expect(loadTerminals(path)).toEqual([legacy])
  const manager = new SessionManager(() => { throw new Error('Not installed') }, () => {})
  for (const saved of loadTerminals(path)!) manager.create(saved.cwd, saved, saved.agent ?? 'opencode')
  saveTerminals(path, manager.list())
  expect(loadTerminals(path)).toEqual([{ ...legacy, agent: 'opencode' }])
  for (const agent of ['invalid', null, 0]) {
    writeFileSync(path, JSON.stringify([{ ...legacy, agent }]))
    const original = JSON.stringify([{ ...legacy, agent }, { id: 'valid', name: 'Keep me', cwd: '/project', agent: 'pi' }])
    writeFileSync(path, original)
    expect(() => loadTerminals(path)).toThrow('Invalid terminal agent in saved workspace')
    expect(readFileSync(path, 'utf8')).toBe(original)
  }
})
it('includes program identity in the writer deduplication key', () => {
  const write = vi.fn()
  const writer = new TerminalStateWriter(write)
  const session = { id: 'one', name: 'Custom', cwd: '/tmp', agent: 'pi' as const }
  writer.save('state.json', [session])
  writer.save('state.json', [{ ...session, agent: 'opencode' }])
  expect(write).toHaveBeenCalledTimes(2)
})
it('retries a failed state write rather than marking it persisted', () => {
  const write = vi.fn().mockImplementationOnce(() => { throw new Error('Disk full') })
  const writer = new TerminalStateWriter(write)
  expect(() => writer.save('state.json', [])).toThrow('Disk full')
  writer.save('state.json', [])
  writer.save('state.json', [])
  expect(write).toHaveBeenCalledTimes(2)
})
it('keeps a restored tab when its process cannot start', () => {
  const manager = new SessionManager(() => { throw new Error('Folder missing') }, () => {})
  expect(manager.create('/missing', { id: 'saved', name: 'Saved tab' })).toMatchObject({ id: 'saved', name: 'Saved tab', cwd: '/missing', status: 'error', error: 'Folder missing' })
})
