import { expect, it, vi } from 'vitest'
import { parsePackagePage, PackageService } from '../src/main/packages'
const html = '<article data-package-card="true" data-package-name="@demo/tools" data-package-types="extension skill" data-package-downloads="100"><p class="packages-desc">Tools &amp; skills</p><div class="packages-meta"><span>Demo</span></div><a href="https://github.com/report?package-version=1.2.3">report</a></article><a href="/packages?page=3">3</a>'
it('extracts safe text and pagination from the real gallery markup', () => {
  expect(parsePackagePage(html, 1)).toEqual({ items: [{ name: '@demo/tools', description: 'Tools & skills', author: 'Demo', types: ['extension', 'skill'], downloads: 100, version: '1.2.3' }], page: 1, pages: 3 })
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
it('rejects invalid query and blocks installations while Workspace sessions are running', async () => {
  const service = new PackageService(async () => html, vi.fn(), () => { throw new Error('Stop sessions') })
  await expect(service.catalog({ page: -1 })).rejects.toThrow()
  await service.catalog({})
  await expect(service.install('@demo/tools', '1.2.3')).rejects.toThrow('Stop sessions')
})
