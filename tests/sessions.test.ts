import { describe, it, expect } from 'vitest'
import { SessionManager, type PtyProcess } from '../src/main/sessions'

function fixture(fail = false) {
  const processes: Array<{ data: (s: string) => void; exit: (n: number) => void; input: string[]; killed: boolean; sizes: number[][] }> = []
  const events: unknown[] = []
  const manager = new SessionManager(() => {
    if (fail) throw new Error('Pi executable not found')
    const p = { data: (_: string) => {}, exit: (_: number) => {}, input: [] as string[], killed: false, sizes: [] as number[][] }
    processes.push(p)
    return { onData: (cb) => { p.data = cb; return { dispose() {} } }, onExit: (cb) => { p.exit = (exitCode) => cb({ exitCode }); return { dispose() {} } }, write: (s) => p.input.push(s), resize: (c, r) => p.sizes.push([c, r]), kill: () => { p.killed = true } } satisfies PtyProcess
  }, (e) => events.push(e), 20)
  return { manager, processes, events }
}

describe('SessionManager', () => {
  it('creates independent sessions and routes input/output only to their owner', () => {
    const { manager: m, processes: p } = fixture()
    const a = m.create('/tmp'), b = m.create('/tmp')
    m.input(a.id, 'hello'); p[1].data('world')
    expect(p[0].input).toEqual(['hello']); expect(p[1].input).toEqual([])
    expect(m.snapshot(a.id).output).toBe(''); expect(m.snapshot(b.id).output).toBe('world')
  })
  it('replays early output with monotonic sequence and bounds history', () => {
    const { manager: m, processes: p } = fixture(); const s = m.create('/tmp')
    p[0].data('12345678901234567890'); p[0].data('ABC')
    expect(m.snapshot(s.id)).toMatchObject({ seq: 2, output: '45678901234567890ABC' })
    expect(m.snapshot(s.id).output.length).toBeLessThanOrEqual(20)
  })
  it('keeps spawn failures visible and restartable', () => {
    const { manager: m } = fixture(true); const s = m.create('/missing')
    expect(s.status).toBe('error'); expect(s.error).toContain('Pi executable not found')
    expect(m.restart(s.id).status).toBe('error'); expect(m.list()).toHaveLength(1)
  })
  it('marks exit without touching another session and ignores late input to exited sessions', () => {
    const { manager: m, processes: p } = fixture(); const a = m.create('/tmp'), b = m.create('/tmp')
    p[0].exit(7)
    expect(m.snapshot(a.id).session).toMatchObject({ status: 'exited', exitCode: 7 })
    expect(m.snapshot(b.id).session.status).toBe('running')
    expect(() => m.input(a.id, 'x')).not.toThrow()
    expect(p[0].input).toEqual([])
  })
  it('stops idempotently and restarts under same id with fresh history', () => {
    const { manager: m, processes: p } = fixture(); const a = m.create('/tmp')
    p[0].data('old'); m.stop(a.id); m.stop(a.id)
    expect(p[0].killed).toBe(true)
    expect(m.restart(a.id)).toMatchObject({ id: a.id, status: 'running', generation: 2 })
    expect(m.snapshot(a.id).output).toBe(''); expect(p).toHaveLength(2)
  })
  it('rejects malformed IPC values and only resizes the selected process', () => {
    const { manager: m, processes: p } = fixture(); const s = m.create('/tmp')
    for (const size of [0, -1, 1.5, Infinity, 1001]) expect(() => m.resize(s.id, size, 24)).toThrow()
    expect(() => m.input(s.id, 'x'.repeat(65537))).toThrow()
    expect(() => m.snapshot('unknown')).toThrow()
    m.resize(s.id, 100, 30); expect(p[0].sizes).toEqual([[100, 30]])
  })
  it('ignores queued input after shutdown while still validating input and session IDs', () => {
    const { manager: m, processes: p } = fixture(); const s = m.create('/tmp')
    m.dispose()
    expect(() => m.input(s.id, '\u001b[1;1R')).not.toThrow()
    expect(() => m.input(s.id, 'queued keystroke')).not.toThrow()
    expect(p[0].input).toEqual([])
    expect(() => m.input(s.id, 'x'.repeat(65537))).toThrow('Invalid terminal input')
    expect(() => m.input('unknown', 'x')).toThrow('Unknown session')
  })
  it('cleans every process on dispose', () => {
    const { manager: m, processes: p } = fixture(); m.create('/tmp'); m.create('/tmp'); m.dispose()
    expect(p.every((s) => s.killed)).toBe(true); expect(m.list().every((s) => s.status === 'exited')).toBe(true)
  })
})
