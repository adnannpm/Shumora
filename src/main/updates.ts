import type { UpdateState } from '../shared/updates'
export interface Updater {
  autoDownload: boolean; autoInstallOnAppQuit: boolean; allowPrerelease: boolean; allowDowngrade: boolean
  on(event: string, callback: (...args: any[]) => void): unknown
  checkForUpdates(): Promise<unknown>
  downloadUpdate(): Promise<unknown>
  quitAndInstall(silent: boolean, forceRunAfter: boolean): void
}
export class UpdateManager {
  private state: UpdateState
  constructor(private driver: Updater, version: string, private emit: (s: UpdateState) => void, private prepareInstall: () => void, unsupported?: string) {
    this.state = { currentVersion: version, status: unsupported ? 'unsupported' : 'idle', reason: unsupported }
    driver.autoDownload = false; driver.autoInstallOnAppQuit = false; driver.allowPrerelease = false; driver.allowDowngrade = false
    driver.on('update-available', (info) => {
      if (this.state.status === 'unsupported') return
      const notes = typeof info.releaseNotes === 'string' ? info.releaseNotes : Array.isArray(info.releaseNotes) ? info.releaseNotes.map((n: { note: string }) => n.note).join('\n\n') : ''
      this.set({ status: 'available', version: info.version, notes: notes.slice(0, 100_000), error: undefined })
    })
    driver.on('update-not-available', () => this.set({ status: 'current', error: undefined }))
    driver.on('download-progress', ({ percent }) => this.set({ status: 'downloading', percent: Math.max(0, Math.min(100, Math.round(percent))) }))
    driver.on('update-downloaded', ({ version }) => this.set({ status: 'downloaded', version, percent: 100, error: undefined }))
    driver.on('error', error => this.fail(error))
  }
  snapshot(): UpdateState { return { ...this.state } }
  private set(change: Partial<UpdateState>) { this.state = { ...this.state, ...change }; this.emit(this.snapshot()) }
  private fail(error: unknown) { this.set({ status: 'error', error: error instanceof Error ? error.message : String(error) }) }
  async check() {
    if (this.state.status === 'unsupported') throw new Error(this.state.reason)
    if (['checking', 'downloading', 'downloaded', 'installing'].includes(this.state.status)) return
    this.set({ status: 'checking', version: undefined, notes: undefined, error: undefined, percent: undefined })
    try { await this.driver.checkForUpdates() } catch (e) { this.fail(e) }
  }
  async download() {
    if (this.state.status !== 'available') throw new Error('Check for an available update first')
    this.set({ status: 'downloading', percent: 0, error: undefined })
    try { await this.driver.downloadUpdate() } catch (e) { this.fail(e) }
  }
  install() {
    if (this.state.status !== 'downloaded') throw new Error('Download an update before installing')
    // Must stop every managed session successfully before quitting the application.
    this.prepareInstall()
    this.set({ status: 'installing' })
    this.driver.quitAndInstall(false, true)
  }
}
