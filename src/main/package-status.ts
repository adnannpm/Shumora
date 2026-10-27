import { readFileSync, existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import type { PackageInstallation } from '../shared/packages'
export function configuredPackageNames(agentDir = resolve(process.env.PI_CODING_AGENT_DIR || join(homedir(), '.pi', 'agent'))): string[] {
  const file = join(agentDir, 'settings.json')
  const settings = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {}
  if (settings.packages !== undefined && !Array.isArray(settings.packages)) throw new Error('Invalid Pi packages configuration')
  return [...new Set<string>((settings.packages || []).flatMap((entry: any) => {
    const source = typeof entry === 'string' ? entry : entry?.source
    if (typeof source !== 'string') return []
    const match = source.match(/^npm:((?:@[a-z0-9._-]+\/)?[a-z0-9][a-z0-9._-]*)(?:@[^\s]+)?$/)
    return match ? [match[1]] : []
  }))]
}
export function packageStatus(name: string, agentDir = resolve(process.env.PI_CODING_AGENT_DIR || join(homedir(), '.pi', 'agent'))): PackageInstallation {
  if (!/^(?:@[a-z0-9._-]+\/)?[a-z0-9][a-z0-9._-]*$/.test(name) || name.length > 214) throw new Error('Invalid package name')
  const settingsPath = join(agentDir, 'settings.json')
  const settings = existsSync(settingsPath) ? JSON.parse(readFileSync(settingsPath, 'utf8')) : {}
  if (settings.packages !== undefined && !Array.isArray(settings.packages)) throw new Error('Invalid Pi packages configuration')
  const sources: string[] = (settings.packages || []).map((entry: any) => typeof entry === 'string' ? entry : entry?.source).filter((source: unknown): source is string => typeof source === 'string')
  const source = sources.find(source => source === `npm:${name}` || source.startsWith(`npm:${name}@`))
  let installedVersion: string | undefined
  const manifest = join(agentDir, 'npm', 'node_modules', name, 'package.json')
  if (existsSync(manifest)) {
    const pkg = JSON.parse(readFileSync(manifest, 'utf8'))
    if (pkg.name === name && typeof pkg.version === 'string') installedVersion = pkg.version
  }
  return { configured: !!source, installed: !!source && !!installedVersion, installedVersion, source }
}
