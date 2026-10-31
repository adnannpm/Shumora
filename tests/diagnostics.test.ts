import { expect, it, vi } from 'vitest'
import { collectDiagnostics, redactDiagnosticText } from '../src/main/diagnostics'
it('reports the resolved launcher, Node, installation and bounded version probes', async () => {
  const run = vi.fn(async (file: string, _args: string[]) => file.endsWith('node.exe') ? 'v24.1.0' : '1.4.0')
  const report = await collectDiagnostics({ platform: 'win32', env: { USERPROFILE: 'C:\\Users\\Alice', PATH: 'C:\\node', SECRET_TOKEN: 'never-copy-me' }, resolve: () => ({ file: 'C:\\Users\\Alice\\.pi\\agent\\bin\\pi.exe', args: [] }), exists: p => p === 'C:\\node\\node.exe', run })
  expect(report.pi.installation).toBe('Official installer')
  expect(report.pi.executable).toBe('<HOME>\\.pi\\agent\\bin\\pi.exe')
  expect(report.node.version).toBe('v24.1.0')
  expect(report.launch.ok).toBe(true)
  expect(run.mock.calls[0][1]).toEqual(['--version'])
  expect(JSON.stringify(report)).not.toContain('never-copy-me')
  expect(JSON.stringify(report)).not.toContain('Alice')
})
it('reports missing launchers without rejecting and still checks Node', async () => {
  const report = await collectDiagnostics({ platform: 'linux', env: { PATH: '/bin' }, resolve: () => { throw new Error('Pi missing') }, exists: p => p === '/bin/node', run: async () => 'v24.0.0' })
  expect(report.launch.ok).toBe(false)
  expect(report.launch.output).toContain('Pi missing')
  expect(report.node.version).toBe('v24.0.0')
})
it('sanitizes failed probe output, URLs, credentials, ANSI and home paths', () => {
  const text = redactDiagnosticText('\u001b[31m/home/alice token=abc123 Authorization: Bearer secret-value https://user:pass@host/path?api_key=hello sk-abcdefghijklmnopqrstuvwxyz\u001b[0m', { HOME: '/home/alice' })
  for (const secret of ['alice', 'abc123', 'secret-value', 'user:pass', 'hello', 'sk-abcdefghijklmnopqrstuvwxyz', '\u001b']) expect(text).not.toContain(secret)
})
it('redacts known secret environment values even without credential labels', () => {
  expect(redactDiagnosticText('failure echoed opaque-credential-value', { PROVIDER_API_KEY: 'opaque-credential-value' })).toBe('failure echoed <REDACTED>')
})
it('captures timeout failures and detects Bun without claiming success', async () => {
  const report = await collectDiagnostics({ platform: 'linux', env: { HOME: '/home/alice', PATH: '' }, resolve: () => ({ file: '/home/alice/.bun/bin/pi', args: [] }), exists: () => false, run: async () => { throw new Error('timed out token=private') } })
  expect(report.pi.installation).toBe('Bun')
  expect(report.launch.ok).toBe(false)
  expect(report.launch.output).toContain('timed out')
  expect(report.launch.output).not.toContain('private')
})
