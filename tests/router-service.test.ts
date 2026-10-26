import { expect, it, vi } from 'vitest'
import { RouterService } from '../src/main/router-service'
it('never stops an external service and starts only while offline', async () => {
  const host = { health: async () => true, start: vi.fn(), stop: vi.fn() }
  const service = new RouterService(host)
  await expect(service.control('start')).rejects.toThrow('already running')
  await expect(service.control('stop')).rejects.toThrow('not started by Shumora')
  expect(host.stop).not.toHaveBeenCalled()
})
it('does not retain ownership when the process exits during startup', async () => {
  const service = new RouterService({ health: async () => false, start: async (_output, exit) => { exit(); return {} }, stop: vi.fn() })
  await expect(service.control('start')).rejects.toThrow('exited')
  expect((await service.state()).managed).toBe(false)
})
it('owns its process, captures bounded logs and supports restart and stop', async () => {
  let online = false
  const host = { health: async () => online, start: vi.fn(async (output, _exit) => { online = true; output('x'.repeat(120000)); return {} }), stop: vi.fn(async () => { online = false }) }
  const service = new RouterService(host)
  await service.control('start')
  expect((await service.state()).managed).toBe(true)
  expect((await service.state()).logs.length).toBeLessThanOrEqual(100000)
  await service.control('restart')
  expect(host.start).toHaveBeenCalledTimes(2)
  await service.control('stop')
  expect((await service.state()).managed).toBe(false)
  await expect(service.control('arbitrary' as any)).rejects.toThrow('Invalid')
})
