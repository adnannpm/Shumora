import { EventEmitter } from 'node:events'
import { expect, it, vi } from 'vitest'
import { UpdateManager, type Updater } from '../src/main/updates'
function fixture(reason?: string) {
  const driver = Object.assign(new EventEmitter(), { autoDownload: true, autoInstallOnAppQuit: true, allowPrerelease: true, allowDowngrade: true, checkForUpdates: vi.fn(async () => ({})), downloadUpdate: vi.fn(async () => []), quitAndInstall: vi.fn() }) as unknown as Updater & EventEmitter
  const prepare = vi.fn()
  const manager = new UpdateManager(driver, '0.1.0', () => {}, prepare, reason)
  return { driver, manager, prepare }
}
it('checks manually, downloads only on request and installs only after readiness', async () => {
  const { driver, manager, prepare } = fixture()
  expect(driver.autoDownload).toBe(false); expect(driver.autoInstallOnAppQuit).toBe(false)
  expect(() => manager.install()).toThrow()
  await manager.check(); expect(manager.snapshot().status).toBe('checking')
  driver.emit('update-available', { version: '0.2.0', releaseNotes: '<b>Changes</b>' })
  expect(manager.snapshot()).toMatchObject({ status: 'available', version: '0.2.0' })
  expect(driver.downloadUpdate).not.toHaveBeenCalled()
  await manager.download(); driver.emit('download-progress', { percent: 42.4 })
  expect(manager.snapshot().percent).toBe(42)
  driver.emit('update-downloaded', { version: '0.2.0' }); manager.install()
  expect(prepare).toHaveBeenCalledOnce(); expect(driver.quitAndInstall).toHaveBeenCalledWith(false, true)
})
it('blocks unsupported installations and reports failures without installing', async () => {
  const { manager, driver } = fixture('Development build')
  await expect(manager.check()).rejects.toThrow('Development build')
  expect(driver.checkForUpdates).not.toHaveBeenCalled()
  const enabled = fixture(); enabled.driver.checkForUpdates = vi.fn(async () => { throw new Error('Network unavailable') })
  await enabled.manager.check(); expect(enabled.manager.snapshot()).toMatchObject({ status: 'error', error: 'Network unavailable' })
  expect(enabled.driver.quitAndInstall).not.toHaveBeenCalled()
})
it('does not install if session cleanup fails', () => {
  const { driver } = fixture()
  const m = new UpdateManager(driver, '0.1.0', () => {}, () => { throw new Error('Cannot stop session') })
  driver.emit('update-downloaded', { version: '0.2.0' })
  expect(() => m.install()).toThrow('Cannot stop session'); expect(driver.quitAndInstall).not.toHaveBeenCalled()
})
