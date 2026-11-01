import { afterEach, expect, it } from 'vitest'
import { existsSync, mkdtempSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { AskPassService } from '../src/main/askpass-service'
const services: AskPassService[] = []
const roots: string[] = []
afterEach(() => { services.forEach(s => s.dispose()); services.length = 0; roots.forEach(p => rmSync(p, { recursive: true, force: true })); roots.length = 0 })
async function start() {
  const root = mkdtempSync(path.join(tmpdir(), 'askpass-security-')); roots.push(root)
  const service = new AskPassService(root); services.push(service); await service.start()
  return { root, service, env: service.getEnv() }
}
it('isolates remembered credentials by request kind, origin, port and username; unknown prompts are not cached', async () => {
  const { service, env } = await start()
  let calls = 0
  service.setHandler(async req => { calls++; service.submitReply({ requestId: req.requestId, passphrase: `secret-${calls}`, remember: true }); return { requestId: req.requestId } })
  async function ask(prompt: string) {
    const res = await fetch(`http://127.0.0.1:${env.SHUMORA_ASKPASS_PORT}/askpass`, { method: 'POST', headers: { Authorization: `Bearer ${env.SHUMORA_ASKPASS_TOKEN}` }, body: JSON.stringify({ prompt }) })
    return (await res.json()).passphrase
  }
  const first = "Password for 'https://alice@git.example.com': "
  expect(await ask(first)).toBe('secret-1')
  expect(await ask(first)).toBe('secret-1')
  for (const prompt of ["Password for 'https://alice@evil.example': ", "Username for 'https://alice@git.example.com': ", "Password for 'https://bob@git.example.com': ", "Password for 'https://alice@git.example.com:8443': ", 'Unknown prompt', 'Unknown prompt']) {
    expect(await ask(prompt)).not.toBe('secret-1')
  }
  expect(calls).toBe(7)
})
it('uses private unique helper directories and removes only its own directory on disposal', async () => {
  const { service, root, env } = await start()
  const helper = path.dirname(env.SHUMORA_ASKPASS_JS)
  expect(helper).not.toBe(root)
  expect(helper.startsWith(root + path.sep)).toBe(true)
  if (process.platform !== 'win32') {
    expect(statSync(helper).mode & 0o777).toBe(0o700)
    expect(statSync(env.SHUMORA_ASKPASS_JS).mode & 0o777).toBe(0o600)
  }
  service.dispose()
  expect(existsSync(helper)).toBe(false)
  expect(existsSync(root)).toBe(true)
})
