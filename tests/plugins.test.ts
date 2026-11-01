import { expect, it, vi } from 'vitest'
import Database from 'better-sqlite3'
import { PluginService, piDefinition, opencodeDefinition, managerDefinitions, type PluginHost } from '../src/main/plugins'
function fixture(installed = false) {
  const db = new Database(':memory:'); const calls: string[][] = []; const events = vi.fn()
  let present = installed
  const host: PluginHost = {
    detect: async () => present ? { installed: true, installedVersion: '0.5.0', executable: '/bin/9router' } : { installed: false },
    catalog: async () => ({ latestVersion: '0.5.109', changelog: '## Changes\n- Fix routing' }),
    run: async args => { calls.push(args); present = args[0] !== 'uninstall' }
  }
  return { db, host, calls, events, service: new PluginService(db, host, events) }
}
it('uses the verified Bun owner for uninstall and rejects switching managers', async () => {
  const { db, host, service } = fixture(true)
  host.managers = async () => ['npm', 'bun']
  host.detect = async () => ({ installed: true, installedVersion: '0.5.0', managed: true, packageManager: 'bun' })
  host.run = vi.fn(async () => { host.detect = async () => ({ installed: false }) })
  await expect(service.mutate('uninstall', undefined, 'npm')).rejects.toThrow('owns this installation')
  expect(host.run).not.toHaveBeenCalled()
  await service.mutate('uninstall')
  expect(host.run).toHaveBeenCalledWith(['remove', '--global', '--ignore-scripts', '9router'], expect.any(Function), 'bun')
  expect(service.operation().status).toBe('success')
  db.close()
})
it('uses the selected available manager for a new installation', async () => {
  const { db, host, service } = fixture()
  host.managers = async () => ['npm', 'pnpm']
  host.run = vi.fn(async () => { host.detect = async () => ({ installed: true, installedVersion: '0.5.109', managed: true, packageManager: 'pnpm' }) })
  await service.status(true)
  await expect(service.mutate('install', '0.5.109', 'bun')).rejects.toThrow('not available')
  await service.mutate('install', '0.5.109', 'pnpm')
  expect(host.run).toHaveBeenCalledWith(['add', '--global', '--ignore-scripts', '9router@0.5.109'], expect.any(Function), 'pnpm')
  expect(service.operation().status).toBe('success')
  db.close()
})
it('streams output before completion and verifies success after npm exits', async () => {
  const { db, host, service, events } = fixture()
  await service.status(true)
  let finish!: () => void
  host.run = async (_args, output) => {
    output?.('npm downloading…\n')
    await new Promise<void>(resolve => { finish = resolve })
    host.detect = async () => ({ installed: true, installedVersion: '0.5.109' })
  }
  const pending = service.mutate('install', '0.5.109')
  await vi.waitFor(() => expect(service.operation().output).toContain('npm downloading'))
  expect(service.operation().status).toBe('running')
  expect(events).toHaveBeenCalled()
  await expect(service.mutate('install', '0.5.109')).rejects.toThrow('already running')
  finish(); await pending
  expect(service.operation().status).toBe('success')
  expect(service.operation().output).toContain('Verifying')
  db.close()
})
it('retains bounded output and failed verification or permission details', async () => {
  const { db, host, service } = fixture()
  await service.status(true)
  host.run = async (_args, output) => { output?.('x'.repeat(150_000)); throw new Error('EACCES denied') }
  await service.mutate('install', '0.5.109')
  expect(service.operation().status).toBe('failed')
  expect(service.operation().output).toContain('EACCES denied')
  expect(service.operation().output.length).toBeLessThanOrEqual(100_000)
  host.run = async () => {}
  await service.mutate('install', '0.5.109')
  expect(service.operation().status).toBe('failed')
  expect(service.operation().output).toContain('does not match')
  expect(service.operation().output).not.toContain('EACCES')
  db.close()
})
it('seeds Pi separately, uses its scoped package and blocks changes while sessions run', async () => {
  const { db, host } = fixture()
  let running = true
  const calls: string[][] = []
  host.run = async args => { calls.push(args); host.detect = async () => ({ installed: true, installedVersion: '0.5.109' }) }
  const pi = new PluginService(db, host, () => {}, piDefinition, () => { if (running) throw new Error('Stop Workspace sessions') })
  await pi.status(true)
  await expect(pi.mutate('install', '0.5.109')).rejects.toThrow('Stop Workspace')
  expect(calls).toEqual([])
  running = false
  expect((await pi.mutate('install', '0.5.109')).id).toBe('pi')
  expect(calls[0].at(-1)).toBe('@earendil-works/pi-coding-agent@0.5.109')
  expect(db.prepare('SELECT id FROM plugins ORDER BY id').all()).toEqual([{ id: '9router' }, { id: 'pi' }])
  db.close()
})
it.each(['pnpm', 'bun', 'yarn'] as const)('installs %s only at an approved version and refuses external installations', async id => {
  const { db, host } = fixture()
  const run = vi.fn<PluginHost['run']>(async () => {})
  host.run = run
  const service = new PluginService(db, host, () => {}, managerDefinitions[id])
  await service.status(true)
  await expect(service.mutate('install', 'latest')).rejects.toThrow()
  await service.mutate('install', '0.5.109')
  expect(run.mock.calls[0][0]).toContain(`${id}@0.5.109`)
  host.detect = async () => ({ installed: true, installedVersion: '0.5.0', managed: false })
  await expect(service.mutate('uninstall')).rejects.toThrow(/manually/)
  expect(run).toHaveBeenCalledTimes(1)
  db.close()
})

it('manages OpenCode using only its approved npm package and verifies installation', async () => {
  const { db, host } = fixture()
  const calls: string[][] = []
  host.run = async args => {
    calls.push(args)
    host.detect = async () => args[0] === 'uninstall' ? { installed: false } : { installed: true, installedVersion: '0.5.109' }
  }
  const service = new PluginService(db, host, () => {}, opencodeDefinition)
  expect((await service.status(true)).id).toBe('opencode')
  await expect(service.mutate('install', 'latest')).rejects.toThrow()
  expect((await service.mutate('install', '0.5.109')).installed).toBe(true)
  expect(calls[0]).toEqual(['install', '--global', '--ignore-scripts', '--no-audit', '--no-fund', 'opencode-ai@0.5.109'])
  expect((await service.mutate('uninstall')).installed).toBe(false)
  expect(calls[1]).toEqual(['uninstall', '--global', '--ignore-scripts', 'opencode-ai'])
  db.close()
})

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
