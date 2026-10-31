import { expect, it, vi } from 'vitest'
import { parsePackagePage, PackageService } from '../src/main/packages'
import { SessionManager, type PtyProcess } from '../src/main/sessions'
const html = '<article data-package-card="true" data-package-name="@demo/tools" data-package-types="extension skill" data-package-downloads="100"><p class="packages-desc">Tools &amp; skills</p><div class="packages-meta"><span>Demo</span></div><a href="https://github.com/report?package-version=1.2.3">report</a></article><a href="/packages?page=3">3</a>'
it('extracts safe text and pagination from the real gallery markup', () => {
  expect(parsePackagePage(html, 1)).toEqual({ items: [{ name: '@demo/tools', description: 'Tools & skills', author: 'Demo', types: ['extension', 'skill'], downloads: 100, version: '1.2.3' }], page: 1, pages: 3 })
})
it('loads preview media separately and rejects unsafe image URLs', async () => {
  const page = html.replace('</article>', '</article><article data-package-card="true" data-package-name="unsafe"></article>')
  const fetchPage = vi.fn(async (url: string) => url.includes('/preview-media?') ? JSON.stringify({ previews: [
    { name: '@demo/tools', media: { url: 'https://images.example.com/demo.png' } },
    { name: 'unsafe', media: { url: 'javascript:alert(1)' } }
  ] }) : page)
  const result = await new PackageService(fetchPage, vi.fn()).catalog({})
  expect(result.items[0].thumbnail).toBe('https://images.example.com/demo.png')
  expect(result.items[1].thumbnail).toBeUndefined()
  expect(fetchPage.mock.calls.some(([url]) => url.includes('name=%40demo%2Ftools'))).toBe(true)
})
it('keeps the catalog usable when the preview API fails', async () => {
  const service = new PackageService(async url => { if (url.includes('/preview-media?')) throw new Error('offline'); return html }, vi.fn())
  expect((await service.catalog({})).items[0].name).toBe('@demo/tools')
})
it('installs only an exact approved catalog version with fixed arguments', async () => {
  const run = vi.fn(async (_args, output) => output('installed\n'))
  const service = new PackageService(async () => html, run)
  await expect(service.install('@demo/tools', '1.2.3')).rejects.toThrow('Refresh')
  await service.catalog({})
  await service.install('@demo/tools', '1.2.3')
  expect(run.mock.calls[0][0]).toEqual(['install', 'npm:@demo/tools@1.2.3'])
  expect(service.operation().status).toBe('success')
  await expect(service.install('../bad', '1.2.3')).rejects.toThrow()
})
it('updates a pinned package and removes its exact configured source', async () => {
  let state = { configured: true, installed: true, installedVersion: '1.0.0', source: 'npm:@demo/tools@1.0.0' }
  const run = vi.fn(async (args: string[]) => { state = args[0] === 'remove' ? { configured: false, installed: false, installedVersion: '', source: '' } : { configured: true, installed: true, installedVersion: '1.2.3', source: 'npm:@demo/tools@1.2.3' } })
  const service = new PackageService(async () => html, run, () => {}, () => {}, () => state)
  await service.catalog({})
  await service.mutate('update', '@demo/tools', '1.2.3')
  expect(run.mock.calls[0][0]).toEqual(['install', 'npm:@demo/tools@1.2.3'])
  await service.mutate('uninstall', '@demo/tools')
  expect(run.mock.calls[1][0]).toEqual(['remove', 'npm:@demo/tools@1.2.3'])
  expect(service.status('@demo/tools').installed).toBe(false)
})
function workspace() {
  const events: string[] = []
  const sessions = new SessionManager(() => {
    events.push('start')
    return { onData: () => ({ dispose() {} }), onExit: () => ({ dispose() {} }), write() {}, resize() {}, kill() { events.push('stop') } } satisfies PtyProcess
  }, () => {})
  const active = sessions.create('/active')
  const stopped = sessions.create('/stopped')
  sessions.stop(stopped.id)
  events.length = 0
  return { sessions, events, active, stopped }
}
it('stops running sessions before a package change and restarts only those after verification', async () => {
  const { sessions, events, active, stopped } = workspace()
  const service = new PackageService(async () => html, async () => {
    expect(sessions.list().every(s => s.status === 'exited')).toBe(true)
    events.push('update')
  }, () => {}, () => {}, undefined, sessions)
  await service.catalog({})
  await service.install('@demo/tools', '1.2.3')
  expect(events).toEqual(['stop', 'update', 'start'])
  expect(sessions.snapshot(active.id).session.status).toBe('running')
  expect(sessions.snapshot(stopped.id).session.status).toBe('exited')
})
it('leaves sessions stopped when the package command fails', async () => {
  const { sessions, events } = workspace()
  const service = new PackageService(async () => html, async () => { throw new Error('offline') }, () => {}, () => {}, undefined, sessions)
  await service.catalog({})
  await expect(service.install('@demo/tools', '1.2.3')).rejects.toThrow('offline')
  expect(events).toEqual(['stop'])
  expect(service.operation().status).toBe('failed')
})
it('does not stop sessions for an unapproved version or invalid package state', async () => {
  const { sessions, events } = workspace()
  const service = new PackageService(async () => html, vi.fn(), () => {}, () => {}, () => ({ configured: true, installed: true }), sessions)
  await expect(service.install('@demo/tools', '1.2.3')).rejects.toThrow('Refresh')
  await service.catalog({})
  await expect(service.install('@demo/tools', '1.2.3')).rejects.toThrow('already configured')
  expect(events).toEqual([])
})
it('does not restart sessions if post-install verification fails', async () => {
  const { sessions, events } = workspace()
  const service = new PackageService(async () => html, async () => {}, () => {}, () => {}, () => ({ configured: false, installed: false }), sessions)
  await service.catalog({})
  await expect(service.install('@demo/tools', '1.2.3')).rejects.toThrow('state does not match')
  expect(events).toEqual(['stop'])
})
it('rejects overlapping operations and does not resurrect a tab closed during installation', async () => {
  const { sessions, active, events } = workspace()
  let finish!: () => void
  const service = new PackageService(async () => html, () => new Promise<void>(resolve => { finish = resolve }), () => {}, () => {}, undefined, sessions)
  await service.catalog({})
  const pending = service.install('@demo/tools', '1.2.3')
  await expect(service.install('@demo/tools', '1.2.3')).rejects.toThrow('Another package operation')
  sessions.close(active.id)
  finish()
  await pending
  expect(events).toEqual(['stop'])
})
it('reports failed session restarts after a successful package change', async () => {
  const { sessions } = workspace()
  const restart = sessions.restart.bind(sessions)
  vi.spyOn(sessions, 'restart').mockImplementation(id => ({ ...restart(id), status: 'error', error: 'spawn failed' }))
  const service = new PackageService(async () => html, async () => {}, () => {}, () => {}, undefined, sessions)
  await service.catalog({})
  await expect(service.install('@demo/tools', '1.2.3')).rejects.toThrow('restart')
  expect(service.operation().output).toContain('spawn failed')
})
it('rejects invalid query and blocks installations while Workspace sessions are running', async () => {
  const service = new PackageService(async () => html, vi.fn(), () => { throw new Error('Stop sessions') })
  await expect(service.catalog({ page: -1 })).rejects.toThrow()
  await service.catalog({})
  await expect(service.install('@demo/tools', '1.2.3')).rejects.toThrow('Stop sessions')
})
