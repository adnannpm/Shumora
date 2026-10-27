import { randomUUID } from 'node:crypto'
import type { Session, SessionEvent, Snapshot } from '../shared/types'

interface Disposable { dispose(): void }
export interface PtyProcess {
  onData(cb: (data: string) => void): Disposable
  onExit(cb: (event: { exitCode: number }) => void): Disposable
  write(data: string): void
  resize(cols: number, rows: number): void
  kill(): void
}
interface Entry { session: Session; process?: PtyProcess; output: string; seq: number; subscriptions: Disposable[] }
export class SessionManager {
  private entries = new Map<string, Entry>()
  private count = 0
  private closed = new Set<string>()
  constructor(private spawn: (cwd: string) => PtyProcess, private emit: (e: SessionEvent) => void, private historyLimit = 512_000) {}
  list(): Session[] { return [...this.entries.values()].map((e) => ({ ...e.session })) }
  private get(id: string): Entry {
    if (typeof id !== 'string' || !this.entries.has(id)) throw new Error('Unknown session')
    return this.entries.get(id)!
  }
  private publish(e: Entry) { this.emit({ type: 'state', session: { ...e.session } }) }
  create(cwd: string): Session {
    if (typeof cwd !== 'string' || !cwd) throw new Error('Invalid directory')
    const e: Entry = { session: { id: randomUUID(), name: `Pi ${++this.count}`, cwd, status: 'exited', generation: 0 }, output: '', seq: 0, subscriptions: [] }
    this.entries.set(e.session.id, e)
    return this.start(e)
  }
  private start(e: Entry): Session {
    e.session = { ...e.session, generation: e.session.generation + 1, status: 'running', error: undefined, exitCode: undefined }
    e.output = ''; e.seq = 0
    const generation = e.session.generation
    try {
      const p = this.spawn(e.session.cwd); e.process = p
      e.subscriptions = [p.onData((data) => {
        if (e.session.generation !== generation || e.process !== p) return
        e.output = (e.output + data).slice(-this.historyLimit)
        this.emit({ type: 'data', id: e.session.id, generation, seq: ++e.seq, data })
      }), p.onExit(({ exitCode }) => {
        if (e.process !== p) return
        e.process = undefined; e.session.status = 'exited'; e.session.exitCode = exitCode
        this.cleanup(e); this.publish(e)
      })]
    } catch (error) {
      e.process = undefined; e.session.status = 'error'
      e.session.error = error instanceof Error ? error.message : String(error)
    }
    this.publish(e); return { ...e.session }
  }
  rename(id: string, name: string): Session {
    const e = this.get(id)
    if (typeof name !== 'string' || !name.trim() || name.trim().length > 120 || /[\x00-\x1f\x7f]/.test(name)) throw new Error('Invalid session name')
    e.session.name = name.trim()
    this.publish(e)
    return { ...e.session }
  }
  snapshot(id: string): Snapshot { const e = this.get(id); return { session: { ...e.session }, output: e.output, seq: e.seq } }
  input(id: string, data: string) {
    if (this.closed.has(id)) {
      if (typeof data !== 'string' || data.length > 65536) throw new Error('Invalid terminal input')
      return
    }
    const e = this.get(id)
    if (typeof data !== 'string' || data.length > 65536) throw new Error('Invalid terminal input')
    // Terminal replies and queued keystrokes can arrive after stop/exit,
    // before the renderer has received the updated session state.
    if (!e.process) return
    e.process.write(data)
  }
  resize(id: string, cols: number, rows: number) {
    if (this.closed.has(id)) return
    const e = this.get(id)
    if (![cols, rows].every((v) => Number.isInteger(v) && v >= 1 && v <= 1000)) throw new Error('Invalid terminal dimensions')
    e.process?.resize(cols, rows)
  }
  private cleanup(e: Entry) { e.subscriptions.forEach((s) => s.dispose()); e.subscriptions = [] }
  stop(id: string) {
    const e = this.get(id); const p = e.process
    if (!p) return
    p.kill()
    e.process = undefined; this.cleanup(e)
    e.session.status = 'exited'; this.publish(e)
  }
  close(id: string) {
    if (this.closed.has(id)) return
    this.stop(id)
    this.entries.delete(id)
    this.closed.add(id)
    // Only recent tombstones are needed for late IPC from disposed terminals.
    if (this.closed.size > 128) this.closed.delete(this.closed.values().next().value!)
    this.emit({ type: 'removed', id })
  }
  restart(id: string): Session { const e = this.get(id); this.stop(id); return this.start(e) }
  dispose() { for (const id of this.entries.keys()) { try { this.stop(id) } catch { /* Continue cleaning other sessions. */ } } }
}
