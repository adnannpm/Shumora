import { afterEach, expect, it, vi } from 'vitest'
import { routerHealth } from '../src/main/router-health'
afterEach(() => vi.unstubAllGlobals())
it('requires a successful health response with ok true', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ ok: true }) })))
  expect(await routerHealth()).toBe(true)
  expect(fetch).toHaveBeenCalledWith('http://127.0.0.1:20128/api/health', expect.objectContaining({ redirect: 'error' }))
  vi.stubGlobal('fetch', async () => ({ ok: true, json: async () => ({ other: true }) }))
  expect(await routerHealth()).toBe(false)
})
it('reports offline for errors and unsuccessful responses', async () => {
  vi.stubGlobal('fetch', async () => { throw new Error('Connection refused') })
  expect(await routerHealth()).toBe(false)
  vi.stubGlobal('fetch', async () => ({ ok: false }))
  expect(await routerHealth()).toBe(false)
})
