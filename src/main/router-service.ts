import type { RouterState, RouterControl } from '../shared/plugins'
export interface RouterHost {
  health(): Promise<boolean>
  start(output: (text: string) => void, exit: () => void): Promise<object>
  stop(process: object): Promise<void>
}
export class RouterService {
  private child?: object
  private busy = false
  private logs = ''
  constructor(private host: RouterHost) {}
  private log(text: string) { this.logs = (this.logs + text).slice(-100_000) }
  async state(): Promise<RouterState> { return { online: await this.host.health(), managed: !!this.child, busy: this.busy, logs: this.logs } }
  async control(action: RouterControl): Promise<RouterState> {
    if (!['start', 'stop', 'restart'].includes(action)) throw new Error('Invalid service action')
    if (this.busy) throw new Error('Another service operation is running')
    this.busy = true
    try {
      if (action !== 'start') {
        if (!this.child) throw new Error('This service was not started by Shumora. Manage it externally.')
        await this.host.stop(this.child); this.child = undefined
        this.log('[Shumora] Service stopped.\n')
      }
      if (action !== 'stop') {
        if (this.child || await this.host.health()) throw new Error('9router is already running. External services are not controlled by Shumora.')
        this.log('[Shumora] Starting local 9router…\n')
        let exited = false
        const child = await this.host.start(text => this.log(text), () => { exited = true; this.child = undefined; this.log('[Shumora] Service exited.\n') })
        if (exited) throw new Error('9router exited during startup')
        this.child = child
      }
    } catch (e) { this.log(`[Shumora] ${String(e)}\n`); throw e }
    finally { this.busy = false }
    return this.state()
  }
  async dispose() { if (this.child) { await this.host.stop(this.child); this.child = undefined } }
}
