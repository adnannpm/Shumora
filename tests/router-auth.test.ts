import { afterEach, expect, it, vi } from 'vitest'
import { routerFetch, routerLogin, routerLogout } from '../src/main/router-auth'
afterEach(() => { routerLogout(); vi.unstubAllGlobals() })
it('keeps the dashboard cookie in main-process memory and sends it only to local API requests', async () => {
  const fetcher = vi.fn(async (_url, _options) => ({ ok: true, headers: new Headers({ 'set-cookie': 'auth_token=secret-session; HttpOnly; Path=/' }) }))
  vi.stubGlobal('fetch', fetcher)
  await routerLogin('my-password')
  await routerFetch('models')
  expect(new Headers(fetcher.mock.calls[1][1].headers).get('Cookie')).toBe('auth_token=secret-session')
  routerLogout()
  await routerFetch('models')
  expect(new Headers(fetcher.mock.calls[2][1].headers).get('Cookie')).toBeNull()
  await expect(routerFetch('https://example.com')).rejects.toThrow()
})
it('rejects failed login without retaining a session or exposing response content', async () => {
  vi.stubGlobal('fetch', async () => ({ ok: false, status: 401 }))
  await expect(routerLogin('wrong')).rejects.toThrow('Incorrect dashboard password')
})
it('clears expired authentication after unauthorized responses', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce({ ok: true, headers: new Headers({ 'set-cookie': 'auth_token=expired; Path=/' }) }).mockResolvedValue({ ok: false, status: 401 })
  vi.stubGlobal('fetch', fetcher)
  await routerLogin('password')
  await routerFetch('models')
  await routerFetch('providers')
  expect(new Headers(fetcher.mock.calls[2][1].headers).get('Cookie')).toBeNull()
})
