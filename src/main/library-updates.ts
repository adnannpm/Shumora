import { gt, valid } from 'semver'
import type { LibraryUpdates, PackageInstallation } from '../shared/packages'
interface UpdateHost {
  names(): string[]
  status(name: string): PackageInstallation
  latest(name: string): Promise<string>
  plugins: { id: 'pi' | '9router'; check(): Promise<{ installed: boolean; installedVersion?: string; latestVersion?: string; error?: string }> }[]
}
export async function checkLibraryUpdates(host: UpdateHost, scope?: 'package' | 'plugin'): Promise<LibraryUpdates> {
  if (scope !== undefined && scope !== 'package' && scope !== 'plugin') throw new Error('Invalid update scope')
  const result: LibraryUpdates = { items: [], errors: [] }
  let names: string[] = []
  try { if (scope !== 'plugin') names = host.names() } catch { result.errors.push('Could not read personal Pi package configuration') }
  // Bounded batches avoid flooding npm for large personal installations.
  for (let start = 0; start < names.length; start += 5) {
    await Promise.all(names.slice(start, start + 5).map(async name => {
      try {
        const local = host.status(name)
        if (!local.installed || !local.installedVersion) { result.errors.push(`Could not verify installation of ${name}`); return }
        const latest = await host.latest(name)
        if (!valid(latest) || !valid(local.installedVersion)) throw new Error('Invalid version')
        if (gt(latest, local.installedVersion)) result.items.push({ kind: 'package', id: name, name, installedVersion: local.installedVersion, latestVersion: latest })
      } catch { result.errors.push(`Could not check package ${name}`) }
    }))
  }
  await Promise.all((scope === 'package' ? [] : host.plugins).map(async plugin => {
    try {
      const status = await plugin.check()
      if (status.error) throw new Error('Unverified plugin')
      if (!status.installed) return
      if (!status.installedVersion || !status.latestVersion || !valid(status.installedVersion) || !valid(status.latestVersion)) throw new Error('Unverified version')
      if (gt(status.latestVersion, status.installedVersion)) result.items.push({ kind: 'plugin', id: plugin.id, name: plugin.id === 'pi' ? 'Pi' : '9router', installedVersion: status.installedVersion, latestVersion: status.latestVersion })
    } catch { result.errors.push(`Could not check plugin ${plugin.id}`) }
  }))
  return result
}
