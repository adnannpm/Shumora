import { expect, it } from 'vitest'
import Database from 'better-sqlite3'
import { PluginService, type PluginHost } from '../src/main/plugins'
function fixture(installed = false) {
  const db = new Database(':memory:'); const calls: string[][] = []
  let present = installed
  const host: PluginHost = {
    detect: async () => present ? { installed: true, installedVersion: '0.5.0', executable: '/bin/9router' } : { installed: false },
    catalog: async () => ({ latestVersion: '0.5.109', changelog: '## Changes\n- Fix routing' }),
    run: async args => { calls.push(args); present = args[0] !== 'uninstall' }
  }
  return { db, host, calls, service: new PluginService(db, host) }
}
it('seeds only 9router and persists metadata while rechecking the real installation', async () => {
  const { db, host, service } = fixture(true)
  const s = await service.status(true)
  expect(s).toMatchObject({ id: '9router', installed: true, installedVersion: '0.5.0', latestVersion: '0.5.109' })
  expect(db.prepare('SELECT id FROM plugins').all()).toEqual([{ id: '9router' }])
  host.detect = async () => ({ installed: false })
  expect((await service.status()).installed).toBe(false)
  db.close()
})
it('installs an explicitly approved version and rejects arbitrary commands or stale versions', async () => {
  const { db, service, calls } = fixture()
  await service.status(true)
  await expect(service.mutate('install', 'latest')).rejects.toThrow()
  await service.mutate('install', '0.5.109')
  expect(calls).toEqual([['install', '--global', '--ignore-scripts', '--no-audit', '--no-fund', '9router@0.5.109']])
  await expect(service.mutate('anything' as any)).rejects.toThrow()
  db.close()
})
it('reports permission failures without claiming success or deleting package files', async () => {
  const { db, host, service, calls } = fixture(true)
  host.run = async () => { throw new Error('EACCES: permission denied') }
  const s = await service.mutate('uninstall')
  expect(s.installed).toBe(true); expect(s.operationError).toContain('EACCES')
  expect(calls).toEqual([]); db.close()
})
