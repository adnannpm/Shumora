import type Database from 'better-sqlite3'
import type { PluginAction, PluginOperation, PluginMetadata, RouterPlugin } from '../shared/plugins'
export interface PluginHost {
  detect(): Promise<Pick<RouterPlugin, 'installed' | 'installedVersion' | 'executable'>>
  catalog(): Promise<Pick<RouterPlugin, 'latestVersion' | 'changelog'>>
  run(args: string[], output?: (text: string) => void): Promise<void>
}
const description = 'A self-hosted AI gateway that connects coding tools to multiple model providers through an OpenAI-compatible endpoint, with provider routing, automatic fallback, and quota tracking.'
export const piDefinition = { id: 'pi', name: 'Pi', packageName: '@earendil-works/pi-coding-agent', repository: 'https://github.com/earendil-works/pi', description: 'An extensible terminal coding agent used by Shumora workspaces.' } as const
const routerDefinition = { id: '9router', name: '9router', packageName: '9router', repository: 'https://github.com/decolua/9router', description } as const
export class PluginService<Id extends 'pi' | '9router' = '9router'> {
  private busy = false
  private refresh?: Promise<PluginMetadata<Id>>
  private progress: PluginOperation = { status: 'idle', output: '' }
  operation(): PluginOperation { return { ...this.progress } }
  private log(text: string) {
    this.progress = { ...this.progress, output: (this.progress.output + text).slice(-100_000) }
    this.emit(this.operation())
  }
  constructor(private db: Database.Database, private host: PluginHost, private emit: (operation: PluginOperation) => void = () => {}, private definition: { id: Id; name: string; packageName: string; repository: string; description: string } = routerDefinition as any, private guard: () => void = () => {}) {
    db.exec('CREATE TABLE IF NOT EXISTS plugins (id TEXT PRIMARY KEY, metadata TEXT NOT NULL)')
    db.prepare('INSERT OR IGNORE INTO plugins (id, metadata) VALUES (?, ?)').run(this.definition.id, JSON.stringify({ id: this.definition.id, name: this.definition.name, description: this.definition.description, repository: this.definition.repository, installed: false, checkedAt: '', busy: false }))
  }
  private saved(): PluginMetadata<Id> { return JSON.parse((this.db.prepare('SELECT metadata FROM plugins WHERE id = ?').get(this.definition.id) as { metadata: string }).metadata) }
  private save(value: PluginMetadata<Id>) { this.db.prepare('UPDATE plugins SET metadata = ? WHERE id = ?').run(JSON.stringify({ ...value, busy: false }), this.definition.id) }
  status(remote = false): Promise<PluginMetadata<Id>> {
    if (this.refresh) return this.refresh
    this.refresh = this.check(remote).finally(() => { this.refresh = undefined })
    return this.refresh
  }
  private async check(remote: boolean): Promise<PluginMetadata<Id>> {
    const value: PluginMetadata<Id> = { ...this.saved(), busy: this.busy, error: undefined }
    try {
      const local = await this.host.detect()
      value.installed = local.installed; value.installedVersion = local.installedVersion; value.executable = local.executable
    } catch (e) { value.error = `Cannot verify local installation: ${String(e)}` }
    if (remote) {
      try { Object.assign(value, await this.host.catalog()) } catch (e) { value.error = [value.error, `Cannot fetch latest metadata: ${String(e)}`].filter(Boolean).join('\n') }
    }
    value.checkedAt = new Date().toISOString(); this.save(value); return value
  }
  async mutate(action: PluginAction, version?: string): Promise<PluginMetadata<Id>> {
    if (!['install', 'update', 'uninstall'].includes(action)) throw new Error('Invalid plugin action')
    if (this.busy) throw new Error('Another plugin operation is already running')
    this.busy = true
    this.progress = { status: 'running', output: '' }
    this.log('[Shumora] Preparing operation…\n')
    try {
      this.guard()
      const s = await this.status()
      if (s.error) throw new Error(s.error)
      if (action === 'install' && s.installed) throw new Error(`${this.definition.name} is already installed`)
      if (action !== 'install' && !s.installed) throw new Error(`${this.definition.name} is not installed`)
      if (action !== 'uninstall' && (!version || !/^\d+\.\d+\.\d+$/.test(version) || version !== s.latestVersion)) throw new Error('Refresh and approve the displayed stable version first')
      const args = action === 'uninstall' ? ['uninstall', '--global', '--ignore-scripts', this.definition.packageName] : ['install', '--global', '--ignore-scripts', '--no-audit', '--no-fund', `${this.definition.packageName}@${version}`]
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
