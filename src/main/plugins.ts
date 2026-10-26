import type Database from 'better-sqlite3'
import type { PluginAction, PluginOperation, RouterPlugin } from '../shared/plugins'
export interface PluginHost {
  detect(): Promise<Pick<RouterPlugin, 'installed' | 'installedVersion' | 'executable'>>
  catalog(): Promise<Pick<RouterPlugin, 'latestVersion' | 'changelog'>>
  run(args: string[], output?: (text: string) => void): Promise<void>
}
const description = 'A self-hosted AI gateway that connects coding tools to multiple model providers through an OpenAI-compatible endpoint, with provider routing, automatic fallback, and quota tracking.'
export class PluginService {
  private busy = false
  private refresh?: Promise<RouterPlugin>
  private progress: PluginOperation = { status: 'idle', output: '' }
  operation(): PluginOperation { return { ...this.progress } }
  private log(text: string) {
    this.progress = { ...this.progress, output: (this.progress.output + text).slice(-100_000) }
    this.emit(this.operation())
  }
  constructor(private db: Database.Database, private host: PluginHost, private emit: (operation: PluginOperation) => void = () => {}) {
    db.exec('CREATE TABLE IF NOT EXISTS plugins (id TEXT PRIMARY KEY, metadata TEXT NOT NULL)')
    db.prepare('INSERT OR IGNORE INTO plugins (id, metadata) VALUES (?, ?)').run('9router', JSON.stringify({ id: '9router', name: '9router', description, repository: 'https://github.com/decolua/9router', installed: false, checkedAt: '', busy: false }))
  }
  private saved(): RouterPlugin { return JSON.parse((this.db.prepare('SELECT metadata FROM plugins WHERE id = ?').get('9router') as { metadata: string }).metadata) }
  private save(value: RouterPlugin) { this.db.prepare('UPDATE plugins SET metadata = ? WHERE id = ?').run(JSON.stringify({ ...value, busy: false }), '9router') }
  status(remote = false): Promise<RouterPlugin> {
    if (this.refresh) return this.refresh
    this.refresh = this.check(remote).finally(() => { this.refresh = undefined })
    return this.refresh
  }
  private async check(remote: boolean): Promise<RouterPlugin> {
    const value: RouterPlugin = { ...this.saved(), busy: this.busy, error: undefined }
    try {
      const local = await this.host.detect()
      value.installed = local.installed; value.installedVersion = local.installedVersion; value.executable = local.executable
    } catch (e) { value.error = `Cannot verify local installation: ${String(e)}` }
    if (remote) {
      try { Object.assign(value, await this.host.catalog()) } catch (e) { value.error = [value.error, `Cannot fetch latest metadata: ${String(e)}`].filter(Boolean).join('\n') }
    }
    value.checkedAt = new Date().toISOString(); this.save(value); return value
  }
  async mutate(action: PluginAction, version?: string): Promise<RouterPlugin> {
    if (!['install', 'update', 'uninstall'].includes(action)) throw new Error('Invalid plugin action')
    if (this.busy) throw new Error('Another plugin operation is already running')
    this.busy = true
    this.progress = { status: 'running', output: '' }
    this.log('[Shumora] Preparing operation…\n')
    try {
      const s = await this.status()
      if (s.error) throw new Error(s.error)
      if (action === 'install' && s.installed) throw new Error('9router is already installed')
      if (action !== 'install' && !s.installed) throw new Error('9router is not installed')
      if (action !== 'uninstall' && (!version || !/^\d+\.\d+\.\d+$/.test(version) || version !== s.latestVersion)) throw new Error('Refresh and approve the displayed stable version first')
      const args = action === 'uninstall' ? ['uninstall', '--global', '--ignore-scripts', '9router'] : ['install', '--global', '--ignore-scripts', '--no-audit', '--no-fund', `9router@${version}`]
      let operationError: string | undefined
      this.log(`$ npm ${args.join(' ')}\n`)
      try { await this.host.run(args, text => this.log(text)) } catch (e) { operationError = `${String(e)}\nNo elevation was attempted. Manage this installation manually if it belongs to root or another user.` }
      this.log('\n[Shumora] Verifying installation…\n')
      const result = await this.status()
      result.busy = false
      result.operationError = operationError
      if (!operationError && result.error) result.operationError = result.error
      if (!result.operationError && (action === 'uninstall' ? result.installed : !result.installed || result.installedVersion !== version)) result.operationError = 'npm completed, but the installation visible on PATH does not match the requested result. Check your npm global prefix and PATH.'
      this.save(result)
      this.progress.status = result.operationError ? 'failed' : 'success'
      this.log(result.operationError ? `[Shumora] Failed: ${result.operationError}\n` : `[Shumora] ${action} successful.\n`)
      return result
    } catch (e) {
      this.progress.status = 'failed'
      this.log(`[Shumora] Failed: ${String(e)}\n`)
      throw e
    } finally { this.busy = false }
  }
}
