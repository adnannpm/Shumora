import { parse } from 'parse5'
import type { PackagePage, PackageQuery, PiPackage, PackageInstallation, PackageAction } from '../shared/packages'
import type { PluginOperation } from '../shared/plugins'
function nodes(node: any): any[] { return [node, ...(node.childNodes || []).flatMap(nodes)] }
function attr(node: any, name: string): string { return node?.attrs?.find((a: any) => a.name === name)?.value || '' }
function text(node: any): string { return node.nodeName === '#text' ? node.value : (node.childNodes || []).map(text).join('') }
const validName = (name: string) => /^(?:@[a-z0-9._-]+\/)?[a-z0-9][a-z0-9._-]*$/.test(name) && name.length <= 214
export function parsePackagePage(html: string, page: number): PackagePage {
  const all = nodes(parse(html))
  const items: PiPackage[] = all.filter(n => attr(n, 'data-package-card') === 'true').flatMap(n => {
    const name = attr(n, 'data-package-name')
    if (!validName(name)) return []
    const children = nodes(n)
    const description = children.find(n => attr(n, 'class').split(' ').includes('packages-desc'))
    const meta = children.find(n => attr(n, 'class') === 'packages-meta')
    const report = children.find(n => attr(n, 'href').includes('package-version='))
    let version = ''
    try { version = new URL(attr(report, 'href')).searchParams.get('package-version') || '' } catch {}
    return [{ name, description: description ? text(description).slice(0, 2000) : '', author: meta ? text(meta.childNodes?.find((n: any) => n.tagName === 'span') || meta).slice(0, 200) : '', types: attr(n, 'data-package-types').split(/\s+/).filter(Boolean), downloads: Number(attr(n, 'data-package-downloads')) || 0, version }]
  })
  let pages = page
  for (const n of all) { try { const url = new URL(attr(n, 'href'), 'https://pi.dev'); if (url.pathname === '/packages') pages = Math.max(pages, Math.min(10000, Number(url.searchParams.get('page')) || 1)) } catch {} }
  if (!items.length && !html.includes('packages-action-bar')) throw new Error('The Pi gallery format changed or returned an invalid page')
  return { items, page, pages }
}
export class PackageService {
  private approved = new Map<string, string>()
  private progress: PluginOperation = { status: 'idle', output: '' }
  private busy = false
  constructor(private fetchPage: (url: string) => Promise<string>, private run: (args: string[], output: (text: string) => void) => Promise<void>, private guard: () => void = () => {}, private emit: (operation: PluginOperation) => void = () => {}, private detect?: (name: string) => PackageInstallation) {}
  status(name: string): PackageInstallation {
    if (!validName(name)) throw new Error('Invalid package name')
    if (!this.detect) throw new Error('Package detection is unavailable')
    return this.detect(name)
  }
  async detail(name: string): Promise<PiPackage> {
    if (!validName(name)) throw new Error('Invalid package name')
    const response = await fetch(`https://registry.npmjs.org/${encodeURIComponent(name)}/latest`, { signal: AbortSignal.timeout(15000), redirect: 'error' })
    if (!response.ok) throw new Error(`npm metadata HTTP ${response.status}`)
    const pkg = await response.json() as any
    if (pkg.name !== name || typeof pkg.version !== 'string' || !/^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/.test(pkg.version)) throw new Error('Invalid npm package metadata')
    this.approved.set(name, pkg.version)
    return { name, version: pkg.version, description: typeof pkg.description === 'string' ? pkg.description.slice(0, 2000) : '', author: typeof pkg.author === 'string' ? pkg.author : pkg.author?.name || '', types: [], downloads: 0 }
  }
  operation() { return { ...this.progress } }
  private log(text: string) { this.progress = { ...this.progress, output: (this.progress.output + text).slice(-100000) }; this.emit(this.operation()) }
  async catalog(query: PackageQuery): Promise<PackagePage> {
    const page = query.page ?? 1, search = query.search ?? '', type = query.type ?? '', sort = query.sort ?? 'downloads'
    if (!Number.isInteger(page) || page < 1 || page > 10000 || typeof search !== 'string' || search.length > 200 || !['', 'extension', 'skill', 'theme', 'prompt'].includes(type) || !['downloads', 'recent', 'name'].includes(sort)) throw new Error('Invalid package query')
    const url = new URL('https://pi.dev/packages'); url.search = new URLSearchParams({ page: String(page), name: search, type, sort }).toString()
    const result = parsePackagePage(await this.fetchPage(url.toString()), page)
    for (const item of result.items) if (/^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/.test(item.version)) this.approved.set(item.name, item.version)
    if (this.detect) for (const item of result.items) { try { item.installation = this.detect(item.name) } catch { /* Unverified status is not treated as missing. */ } }
    return result
  }
  install(name: string, version: string) { return this.mutate('install', name, version) }
  async mutate(action: PackageAction, name: string, version?: string): Promise<PluginOperation> {
    if (this.busy) throw new Error('Another package operation is running')
    if (!['install', 'update', 'uninstall'].includes(action) || !validName(name)) throw new Error('Invalid package action')
    if (action !== 'uninstall' && (!version || this.approved.get(name) !== version)) throw new Error('Refresh and approve an exact catalog version first')
    this.busy = true; this.progress = { status: 'running', output: '' }
    try {
      this.guard()
      const current = this.detect?.(name)
      if (action === 'install' && current?.configured) throw new Error('Package is already configured. Use Update or Repair.')
      if (action !== 'install' && !current?.configured) throw new Error('Package is not configured in personal Pi settings')
      const args = action === 'uninstall' ? ['remove', current!.source!] : ['install', `npm:${name}@${version}`]
      this.log(`$ pi ${args.join(' ')}\n`)
      await this.run(args, value => this.log(value))
      if (this.detect) {
        const result = this.detect(name)
        if (action === 'uninstall' ? result.configured : !result.installed || result.installedVersion !== version) throw new Error('Pi completed, but package state does not match the requested result. Check the personal Pi configuration.')
      }
      this.progress.status = 'success'; this.log(`\n[Shumora] Package ${action} completed. Start a new session to load changes.\n`)
    } catch (e) { this.progress.status = 'failed'; this.log(`\n[Shumora] ${String(e)}\n`); throw e }
    finally { this.busy = false }
    return this.operation()
  }
}
