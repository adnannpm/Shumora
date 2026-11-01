import type Database from 'better-sqlite3'
import { globalPackageArgs, packageManagerNames } from './package-managers'
import type { PluginId, PackageManager, PluginAction, PluginOperation, PluginMetadata, RouterPlugin } from '../shared/plugins'
export interface PluginHost {
  detect(): Promise<Pick<RouterPlugin, 'installed' | 'installedVersion' | 'executable' | 'managed' | 'packageManager' | 'installationKind'>>
  catalog(): Promise<Pick<RouterPlugin, 'latestVersion' | 'changelog'>>
  managers?(): Promise<PackageManager[]>
  run(args: string[], output?: (text: string) => void, manager?: PackageManager): Promise<void>
}
const description = 'A self-hosted AI gateway that connects coding tools to multiple model providers through an OpenAI-compatible endpoint, with provider routing, automatic fallback, and quota tracking.'
export const piDefinition = { id: 'pi', name: 'Pi', packageName: '@earendil-works/pi-coding-agent', repository: 'https://github.com/earendil-works/pi', description: 'An extensible terminal coding agent used by Shumora workspaces.' } as const
export const opencodeDefinition = { id: 'opencode', name: 'OpenCode', packageName: 'opencode-ai', repository: 'https://github.com/anomalyco/opencode', description: 'An open source AI coding agent for the terminal.' } as const
export const managerDefinitions = {
  pnpm: { id: 'pnpm', name: 'pnpm', packageName: 'pnpm', repository: 'https://github.com/pnpm/pnpm', description: 'Fast, disk space efficient package manager.' },
  bun: { id: 'bun', name: 'Bun', packageName: 'bun', repository: 'https://github.com/oven-sh/bun', description: 'JavaScript runtime, bundler, test runner and package manager.' },
  yarn: { id: 'yarn', name: 'Yarn', packageName: 'yarn', repository: 'https://github.com/yarnpkg/yarn', description: 'Package manager for JavaScript projects. npm installs Yarn Classic.' }
} as const
const routerDefinition = { id: '9router', name: '9router', packageName: '9router', repository: 'https://github.com/decolua/9router', description } as const
export class PluginService<Id extends PluginId = '9router'> {
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
      value.installed = local.installed; value.installedVersion = local.installedVersion; value.executable = local.executable; value.managed = local.managed; value.packageManager = local.packageManager; value.installationKind = local.installationKind
      value.availableManagers = this.host.managers ? await this.host.managers() : ['npm']
    } catch (e) { value.error = `Cannot verify local installation: ${String(e)}` }
    if (remote) {
      try { Object.assign(value, await this.host.catalog()) } catch (e) { value.error = [value.error, `Cannot fetch latest metadata: ${String(e)}`].filter(Boolean).join('\n') }
    }
    value.checkedAt = new Date().toISOString(); this.save(value); return value
  }
  async mutate(action: PluginAction, version?: string, requestedManager?: PackageManager): Promise<PluginMetadata<Id>> {
    if (!['install', 'update', 'uninstall'].includes(action)) throw new Error('Invalid plugin action')
    if (requestedManager !== undefined && !packageManagerNames.includes(requestedManager)) throw new Error('Invalid package manager')
    if (this.busy) throw new Error('Another plugin operation is already running')
    this.busy = true
    this.progress = { status: 'running', output: '' }
    this.log('[Shumora] Preparing operation…\n')
    try {
      this.guard()
      const s = await this.status()
      if (s.error) throw new Error(s.error)
      if (s.installed && s.managed === false) throw new Error(s.installationKind === 'pi-windows-installer' ? 'Pi Windows installer detected. Global package-manager commands cannot update or remove this installation. Use the original installer to manage Pi; your .pi agent data must not be deleted.' : 'Cannot verify which package manager owns this installation. Manage it manually.')
      const manager = s.installed ? s.packageManager || 'npm' : requestedManager || s.availableManagers?.[0] || 'npm'
      if (s.installed && requestedManager && requestedManager !== manager) throw new Error('Use the package manager that owns this installation')
      if (this.host.managers && !s.availableManagers?.includes(manager)) throw new Error(`${manager} global installation is not available`)
      if (action === 'install' && s.installed) throw new Error(`${this.definition.name} is already installed`)
      if (action !== 'install' && !s.installed) throw new Error(`${this.definition.name} is not installed`)
      if (action !== 'uninstall' && (!version || !/^\d+\.\d+\.\d+$/.test(version) || version !== s.latestVersion)) throw new Error('Refresh and approve the displayed stable version first')
      const args = globalPackageArgs(manager, action === 'uninstall', action === 'uninstall' ? this.definition.packageName : `${this.definition.packageName}@${version}`)
      let operationError: string | undefined
      try { await this.host.run(args, text => this.log(text), manager) } catch (e) { operationError = `${String(e)}\nNo elevation was attempted.` }
      this.log('\n[Shumora] Verifying installation…\n')
      const result = await this.status()
      result.busy = false
      result.operationError = operationError
      if (!operationError && result.error) result.operationError = result.error
      if (!result.operationError && (action === 'uninstall' ? result.installed : !result.installed || result.installedVersion !== version)) result.operationError = `${manager} completed, but the installation visible on PATH does not match the requested result. Check the global installation location and PATH.`
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
