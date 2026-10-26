import { afterEach, expect, it, vi } from 'vitest'
import { fetchPackagePage } from '../src/main/package-fetch'
afterEach(() => vi.unstubAllGlobals())
it('follows gallery canonical redirects on the same origin', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce({ status: 302, headers: new Headers({ location: '/packages' }) }).mockResolvedValueOnce({ status: 200, ok: true, text: async () => '<html>gallery</html>' })
  vi.stubGlobal('fetch', fetcher)
  expect(await fetchPackagePage('https://pi.dev/packages?page=1')).toBe('<html>gallery</html>')
  expect(fetcher.mock.calls[1][0]).toBe('https://pi.dev/packages')
})
it('rejects cross-origin redirects and redirect loops', async () => {
  vi.stubGlobal('fetch', async () => ({ status: 302, headers: new Headers({ location: 'https://other.example/packages' }) }))
  await expect(fetchPackagePage('https://pi.dev/packages')).rejects.toThrow('origin')
  vi.stubGlobal('fetch', async () => ({ status: 302, headers: new Headers({ location: '/packages' }) }))
  await expect(fetchPackagePage('https://pi.dev/packages')).rejects.toThrow('redirect')
})
