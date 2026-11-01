import { afterEach, expect, it, vi } from 'vitest'
vi.mock('../src/main/router-auth', () => ({ routerFetch: vi.fn() }))
import { routerFetch } from '../src/main/router-auth'
import { routerQuota } from '../src/main/router-quota'
afterEach(() => vi.resetAllMocks())
it('whitelists quota data and excludes credentials and invalid reset fields', async () => {
  vi.mocked(routerFetch).mockResolvedValue(new Response(JSON.stringify({ accessToken: 'secret', plan: 'Pro', quotas: { weekly: { used: 40, total: 100, remainingPercentage: 60, resetAt: '2026-09-01T00:00:00Z', accessToken: 'secret' }, invalid: { used: -2, resetAt: 'invalid' } } })))
  const result = await routerQuota('account-1')
  expect(result.quotas).toHaveLength(1)
  expect(result.quotas[0]).toMatchObject({ name: 'weekly', remainingPercentage: 60, resetAt: '2026-09-01T00:00:00.000Z' })
  expect(JSON.stringify(result)).not.toContain('secret')
  expect(routerFetch).toHaveBeenCalledWith('usage/account-1', expect.objectContaining({ method: 'GET', redirect: 'error' }))
})
it('does not invent a zero balance for unsupported providers', async () => {
  vi.mocked(routerFetch).mockResolvedValue(new Response(JSON.stringify({ message: 'Usage not available' })))
  expect((await routerQuota('account-1')).quotas).toEqual([])
})
it('rejects invalid connection IDs before requesting and handles authentication', async () => {
  await expect(routerQuota('../secrets')).rejects.toThrow('Invalid connection ID')
  expect(routerFetch).not.toHaveBeenCalled()
  vi.mocked(routerFetch).mockResolvedValue(new Response('', { status: 401 }))
  await expect(routerQuota('account-1')).rejects.toThrow('Sign in')
})
it('does not forward potentially sensitive upstream errors', async () => {
  vi.mocked(routerFetch).mockResolvedValue(new Response(JSON.stringify({ error: 'Bearer secret' })))
  await expect(routerQuota('account-1')).rejects.toThrow('Check the connection')
})
