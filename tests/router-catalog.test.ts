import { afterEach, expect, it, vi } from 'vitest'
import { RouterCatalog } from '../src/main/router-catalog'
afterEach(() => vi.unstubAllGlobals())
it('returns safe provider metadata without credentials', async () => {
  vi.stubGlobal('fetch', async () => ({ ok: true, json: async () => ({ connections: [{ id: 'a', provider: 'openai', name: 'Work', apiKey: 'secret', accessToken: 'secret', isActive: true }] }) }))
  const result = await new RouterCatalog().providers()
  expect(result).toEqual([{ id: 'a', provider: 'openai', name: 'Work', active: true, status: 'unknown' }])
  expect(JSON.stringify(result)).not.toContain('secret')
})
it('validates mutations and sends explicit overwrite protection', async () => {
  const fetcher = vi.fn(async (_url, options) => ({ ok: true, json: async () => options.method === 'GET' ? { connections: [] } : { connection: { id: 'a' } } }))
  vi.stubGlobal('fetch', fetcher)
  const api = new RouterCatalog()
  await api.add({ provider: 'openai', name: 'Work', apiKey: 'secret' })
  expect(JSON.parse(fetcher.mock.calls[1][1].body)).toMatchObject({ allowOverwrite: false, overwrite: false })
  await expect(api.add({ provider: '', name: 'Work', apiKey: 'secret' })).rejects.toThrow()
  await expect(api.remove('../keys')).rejects.toThrow()
})
it('rejects duplicate connections before submitting credentials', async () => {
  const fetcher = vi.fn(async (_url, _options) => ({ ok: true, json: async () => ({ connections: [{ id: 'a', provider: 'openai', name: 'Work' }] }) }))
  vi.stubGlobal('fetch', fetcher)
  await expect(new RouterCatalog().add({ provider: 'openai', name: 'Work', apiKey: 'secret' })).rejects.toThrow('already exists')
  expect(fetcher).toHaveBeenCalledTimes(1)
})
it('merges disabled models and toggles without removing other disabled IDs', async () => {
  const fetcher = vi.fn(async (url: string, options: any) => ({ ok: true, json: async () => url.includes('models/disabled') ? { disabled: { openai: ['gpt-old', 'gpt-other'] } } : { models: [{ provider: 'openai', model: 'gpt-new', fullModel: 'openai/gpt-new', routedModel: 'openai/gpt-new' }] } }))
  vi.stubGlobal('fetch', fetcher)
  const api = new RouterCatalog()
  expect(await api.models()).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'openai/gpt-old', enabled: false })]))
  await api.modelEnabled('openai', 'gpt-new', false)
  const call = fetcher.mock.calls.find(([, options]) => options.method === 'POST')!
  expect(JSON.parse(call[1].body).ids).toEqual(['gpt-old', 'gpt-other', 'gpt-new'])
})
it('edits only allowed connection fields and creates a custom node', async () => {
  const fetcher = vi.fn(async (_url, _options) => ({ ok: true, json: async () => ({ node: { id: 'openai-compatible-test' } }) }))
  vi.stubGlobal('fetch', fetcher)
  const api = new RouterCatalog()
  await api.edit('abc', { name: 'Changed', apiKey: 'replacement' })
  expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({ name: 'Changed', apiKey: 'replacement' })
  expect(await api.custom({ name: 'Local', prefix: 'local', baseUrl: 'http://127.0.0.1:11434/v1', type: 'openai-compatible', apiType: 'chat' })).toBe('openai-compatible-test')
  await expect(api.custom({ name: 'Bad', prefix: 'bad', baseUrl: 'file:///etc/passwd', type: 'openai-compatible', apiType: 'chat' })).rejects.toThrow()
})
it('requires HTTPS for remote providers but permits literal loopback HTTP', async () => {
  const fetcher = vi.fn(async () => ({ ok: true, json: async () => ({ node: { id: 'local' } }) }))
  vi.stubGlobal('fetch', fetcher)
  const api = new RouterCatalog()
  const input = { name: 'Test', prefix: 'test', type: 'openai-compatible', apiType: 'chat' } as const
  for (const baseUrl of ['http://remote.example/v1', 'http://192.168.1.10/v1', 'http://localhost.evil.example/v1']) {
    await expect(api.custom({ ...input, baseUrl })).rejects.toThrow(/HTTPS/)
  }
  expect(fetcher).not.toHaveBeenCalled()
  for (const baseUrl of ['http://127.0.0.1:11434/v1', 'http://[::1]:11434/v1', 'http://localhost:11434/v1', 'https://remote.example/v1']) await api.custom({ ...input, baseUrl })
  expect(fetcher).toHaveBeenCalledTimes(4)
})

it('saves aliases with the real full model ID and reports HTTP failures safely', async () => {
  const fetcher = vi.fn(async (_url, _options) => ({ ok: true, json: async () => ({ success: true }) }))
  vi.stubGlobal('fetch', fetcher)
  await new RouterCatalog().alias('openai/gpt-4.1', 'coding')
  expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({ model: 'openai/gpt-4.1', alias: 'coding' })
  vi.stubGlobal('fetch', async () => ({ ok: false, status: 401 }))
  await expect(new RouterCatalog().models()).rejects.toThrow('login')
})
