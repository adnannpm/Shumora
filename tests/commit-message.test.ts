import { expect, it, vi } from 'vitest'
import { buildPrompt, cleanMessage, generateCommitMessage, routerChatModels } from '../src/main/commit-message'

const context = { recent: ['feat(ui): add tabs', 'fix: crash on close'], stat: ' a.ts | 2 +-', patch: '+x', truncated: false }
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

it('includes recent subjects so the model follows the repository style', () => {
  const [system, user] = buildPrompt(context)
  expect(system.content).toMatch(/recent commit subjects/)
  expect(user.content).toContain('- feat(ui): add tabs')
  expect(user.content).toContain('+x')
})

it('strips reasoning, fences and quotes', () => {
  expect(cleanMessage('<think>hmm</think>\n```\nfix: a\n\nbody\n```')).toBe('fix: a\n\nbody')
  expect(cleanMessage('"feat: b"')).toBe('feat: b')
})

it('calls 9router chat completions with the local API key', async () => {
  const fetch = vi.fn(async (_url: string, _init?: RequestInit) => json(200, { choices: [{ message: { content: 'fix: thing' } }] }))
  const message = await generateCommitMessage('kr/auto', context, { fetch: fetch as any, key: async () => 'sk-test' })
  expect(message).toBe('fix: thing')
  const [url, init] = fetch.mock.calls[0]
  expect(url).toBe('http://127.0.0.1:20128/v1/chat/completions')
  expect((init!.headers as Record<string, string>).Authorization).toBe('Bearer sk-test')
  expect(JSON.parse(String(init!.body))).toMatchObject({ model: 'kr/auto', stream: false })
})

it('explains missing keys, provider errors and invalid models', async () => {
  const fetch = vi.fn(async () => json(400, { error: { message: 'model not found' } }))
  await expect(generateCommitMessage('kr/auto', context, { fetch: fetch as any, key: async () => undefined })).rejects.toThrow(/API key/)
  await expect(generateCommitMessage('kr/auto', context, { fetch: fetch as any, key: async () => 'k' })).rejects.toThrow('9router: model not found')
  await expect(generateCommitMessage('bad model', context, { fetch: fetch as any, key: async () => 'k' })).rejects.toThrow(/Choose a model/)
})

it('lists models and reports an offline router', async () => {
  expect(await routerChatModels({ fetch: (async () => json(200, { data: [{ id: 'kr/auto' }, { id: 'bad id' }] })) as any })).toEqual(['kr/auto'])
  await expect(routerChatModels({ fetch: (async () => { throw new Error('ECONNREFUSED') }) as any })).rejects.toThrow(/not running/)
})
