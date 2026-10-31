import { lstat, realpath, unlink } from 'node:fs/promises'
import path from 'node:path'
import type { ToolCacheEntry, ToolCacheReport } from '../shared/tool-cache'

// Explicit disposable metadata only. Never delete an entire tool directory:
// caches can contain downloaded executables, models or third-party extensions.
export class ToolCache {
  private busy = false
  constructor(private home: string, private cacheHome: string) {}
  private targets() {
    return [
      { id: 'pi', name: 'Pi', files: [path.join(this.cacheHome,'pi','9router-discovery-cache.json'), path.join(this.cacheHome,'pi','9router-model-metadata.json')] },
      { id: 'opencode', name: 'OpenCode', files: [path.join(this.cacheHome,'opencode','models.json')] },
      { id: '9router', name: '9router', files: [] },
      ...['npm','pnpm','bun','yarn'].map(id => ({id, name: id === 'bun' ? 'Bun' : id, files: []}))
    ]
  }
  private async safeFile(file: string): Promise<number> {
    // Reject symlinks/junctions in every component, including parent folders.
    const absolute = path.resolve(file)
    const parsed = path.parse(absolute)
    let current = parsed.root
    for (const part of absolute.slice(parsed.root.length).split(path.sep)) {
      current = path.join(current,part)
      const stat = await lstat(current)
      if (stat.isSymbolicLink()) return 0
    }
    if (await realpath(absolute) !== absolute) return 0
    const stat = await lstat(absolute)
    return stat.isFile() ? stat.size : 0
  }
  private async collect(clear = false): Promise<ToolCacheReport> {
    let freedBytes = 0
    const entries: ToolCacheEntry[] = []
    for (const target of this.targets()) {
      const entry = { id: target.id, name: target.name, bytes: 0, files: 0, supported: target.files.length > 0, failed: false }
      for (const file of target.files) {
        try {
          const bytes = await this.safeFile(file)
          if (!bytes) continue
          if (clear) { await unlink(file); freedBytes += bytes }
          else { entry.bytes += bytes; entry.files++ }
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') entry.failed = true
        }
      }
      entries.push(entry)
    }
    if (clear) {
      const after = await this.collect()
      after.entries.forEach(entry => { entry.failed ||= entries.some(previous => previous.id === entry.id && previous.failed) })
      return { ...after, freedBytes }
    }
    return { entries, totalBytes: entries.reduce((sum,entry) => sum + entry.bytes,0) }
  }
  scan() { return this.collect() }
  async clear() {
    if (this.busy) throw new Error('Cache cleanup is already running')
    this.busy = true
    try { return await this.collect(true) } finally { this.busy = false }
  }
}
