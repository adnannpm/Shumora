import { afterEach, expect, it, vi } from 'vitest'
import { routerKeys, routerCreateKey } from '../src/main/router-keys'
afterEach(() => vi.unstubAllGlobals())
it('loads actual keys and creates only a named key at a fixed local endpoint', async () => {
  const key = { id: 'id', name: 'Coding', key: 'secret' }
  const fetcher = vi.fn(async (_url, options) => ({ ok: true, json: async () => options.method === 'POST' ? key : { keys: [key] } }))
  vi.stubGlobal('fetch', fetcher)
  expect(await routerKeys()).toEqual([key])
  expect(await routerCreateKey('Coding')).toEqual(key)
  expect(fetcher.mock.calls[1][1].body).toBe(JSON.stringify({ name: 'Coding' }))
  await expect(routerCreateKey('')).rejects.toThrow('name')
})
it('reports authentication requirements without leaking response content', async () => {
  vi.stubGlobal('fetch', async () => ({ ok: false, status: 401 }))
  await expect(routerKeys()).rejects.toThrow('login')
})
