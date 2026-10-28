import { EventEmitter } from 'node:events'
import { afterEach, expect, it, vi } from 'vitest'

const exec = vi.hoisted(() => ({ callback: undefined as any, child: undefined as any, shim: false, files: {} as Record<string, string> }))
vi.mock('node:child_process', () => ({ execFile: vi.fn((_file, _args, _options, callback) => { exec.callback = callback; return exec.child }) }))
vi.mock('node:fs', () => ({
  accessSync: (file: string) => {
    if (file in exec.files) return
    const name = file.split(/[\\/]/).pop()
    if (exec.shim ? name !== 'npm.cmd' && name !== 'node.exe' : name !== 'npm' && name !== 'npm.exe') throw new Error('not found')
  },
  constants: { F_OK: 0, X_OK: 1 }, existsSync: (file: string) => file in exec.files || exec.shim && /npm-cli\.js$/.test(file), readFileSync: (file: string) => { if (!(file in exec.files)) throw new Error('missing'); return exec.files[file] }, realpathSync: (file: string) => file
}))
import { pluginHost, piPluginHost } from '../src/main/plugin-host'
import { execFile } from 'node:child_process'
afterEach(() => { vi.restoreAllMocks(); vi.clearAllMocks(); exec.shim = false; exec.files = {}; vi.unstubAllEnvs() })

it.each(['linux', 'darwin', 'win32'] as const)('streams stdout/stderr before completion on %s', async platform => {
  vi.spyOn(process, 'platform', 'get').mockReturnValue(platform)
  exec.child = { stdout: new EventEmitter(), stderr: new EventEmitter() }
  const chunks: string[] = []
  const pending = pluginHost.run(['install', '--global', '9router@0.5.109'], text => chunks.push(text))
  let settled = false
  void pending.then(() => { settled = true }, () => { settled = true })
  exec.child.stdout.emit('data', 'downloading\n')
  exec.child.stderr.emit('data', 'npm WARN example\n')
  expect(chunks).toEqual(['downloading\n', 'npm WARN example\n'])
  expect(settled).toBe(false)
  exec.callback(new Error('npm exited 1'), '', 'EACCES')
  await expect(pending).rejects.toThrow('EACCES')
})
it('detects the active release of the official Windows Pi installer', async () => {
  vi.spyOn(process, 'platform', 'get').mockReturnValue('win32')
  const bin = 'C:\\Users\\Alice Smith\\.pi\\agent\\bin'
  vi.stubEnv('PI_EXECUTABLE', `${bin}\\pi.cmd`)
  exec.files = {
    [`${bin}\\pi.cmd`]: '',
    ['C:\\Users\\Alice Smith\\.pi\\agent\\install\\current-version']: '1.4.0\r\n',
    ['C:\\Users\\Alice Smith\\.pi\\agent\\install\\releases\\1.4.0\\node_modules\\@earendil-works\\pi-coding-agent\\package.json']: JSON.stringify({ name: '@earendil-works/pi-coding-agent', version: '1.4.0' })
  }
  await expect(piPluginHost.detect()).resolves.toEqual({ installed: true, installedVersion: '1.4.0', executable: `${bin}\\pi.cmd` })
})
it('runs Windows npm.cmd through node and npm-cli.js without a shell', async () => {
  vi.spyOn(process, 'platform', 'get').mockReturnValue('win32')
  exec.shim = true
  exec.child = { stdout: new EventEmitter(), stderr: new EventEmitter() }
  const pending = pluginHost.run(['install', '--global', '9router@0.5.109'])
  const [file, args, options] = vi.mocked(execFile).mock.calls[0] as any
  expect(file).toMatch(/node\.exe$/)
  expect(args[0]).toMatch(/npm-cli\.js$/)
  expect(args.slice(1)).toEqual(['install', '--global', '9router@0.5.109'])
  expect(options.shell).toBeUndefined()
  exec.callback(null, '', '')
  await pending
})
