import { EventEmitter } from 'node:events'
import { afterEach, expect, it, vi } from 'vitest'

const exec = vi.hoisted(() => ({ callback: undefined as any, child: undefined as any, shim: false, responses: {} as Record<string, string>, files: {} as Record<string, string> }))
vi.mock('node:child_process', () => ({ execFile: vi.fn((_file, _args, _options, callback) => { exec.callback = callback; const response = exec.responses[_args.join(' ')]; if (response !== undefined) queueMicrotask(() => callback(null, response, '')); else if (_args.includes('--version') && !String(_file).endsWith('opencode') && !String(_file).endsWith('/node')) queueMicrotask(() => callback(null, '1.0.0\n', '')); if (_args.includes('root')) queueMicrotask(() => callback(new Error('No global installation'), '', '')); return exec.child }) }))
vi.mock('node:fs', () => ({
  accessSync: (file: string) => {
    if (file in exec.files) return
    const name = file.split(/[\\/]/).pop()
    if (exec.shim ? name !== 'npm.cmd' && name !== 'node.exe' : name !== 'npm' && name !== 'npm.exe') throw new Error('not found')
  },
  constants: { F_OK: 0, X_OK: 1 }, existsSync: (file: string) => file in exec.files || exec.shim && /npm-cli\.js$/.test(file), readFileSync: (file: string) => { if (!(file in exec.files)) throw new Error('missing'); return exec.files[file] }, realpathSync: (file: string) => file
}))
import { pluginHost, piPluginHost, opencodePluginHost, detectNode, installTimeout } from '../src/main/plugin-host'
import { execFile } from 'node:child_process'
afterEach(() => { vi.restoreAllMocks(); vi.clearAllMocks(); exec.shim = false; exec.responses = {}; exec.files = {}; vi.unstubAllEnvs() })

it.each([
  ['1.18.34\n', '1.18.34'],
  ['opencode v2.2.5\n', '2.2.5'],
  ['opencode 2.2.5\r\n', '2.2.5'],
  ['v2.2.5\n', '2.2.5']
])('recognizes standalone OpenCode version output %j without npm metadata', async (output, version) => {
  vi.spyOn(process, 'platform', 'get').mockReturnValue('linux')
  vi.stubEnv('PATH', '/standalone')
  exec.files['/standalone/opencode'] = ''
  exec.child = { stdout: new EventEmitter(), stderr: new EventEmitter() }
  const pending = opencodePluginHost.detect()
  await vi.waitFor(() => expect(vi.mocked(execFile).mock.calls.some(call => String(call[0]).endsWith('opencode'))).toBe(true))
  exec.callback(null, output, '')
  expect(await pending).toEqual({ installed: true, installedVersion: version, executable: '/standalone/opencode', managed: false })
})

it.each([
  'error: opencode v2.2.5',
  'opencode v2.2.5\nstartup failed',
  'opencode version unavailable'
])('rejects unverified standalone OpenCode version output %j', async output => {
  vi.spyOn(process, 'platform', 'get').mockReturnValue('linux')
  vi.stubEnv('PATH', '/standalone')
  exec.files['/standalone/opencode'] = ''
  exec.child = { stdout: new EventEmitter(), stderr: new EventEmitter() }
  const pending = expect(opencodePluginHost.detect()).rejects.toThrow('package version could not be verified')
  await vi.waitFor(() => expect(vi.mocked(execFile).mock.calls.some(call => String(call[0]).endsWith('opencode'))).toBe(true))
  exec.callback(null, output, '')
  await pending
})

it('detects Node.js on PATH rather than reporting the embedded Electron runtime', async () => {
  vi.spyOn(process, 'platform', 'get').mockReturnValue('linux')
  exec.files['/runtime/node'] = ''
  vi.stubEnv('PATH', '/runtime')
  exec.child = { stdout: new EventEmitter(), stderr: new EventEmitter() }
  const pending = detectNode()
  expect(vi.mocked(execFile).mock.calls[0][0]).toBe('/runtime/node')
  expect(vi.mocked(execFile).mock.calls[0][1]).toEqual(['--version'])
  exec.callback(null, 'v22.20.0\n', '')
  expect(await pending).toEqual({ installed: true, installedVersion: '22.20.0', executable: '/runtime/node' })
})

it.each(['linux', 'darwin', 'win32'] as const)('streams stdout/stderr before completion on %s', async platform => {
  vi.spyOn(process, 'platform', 'get').mockReturnValue(platform)
  exec.child = { stdout: new EventEmitter(), stderr: new EventEmitter() }
  const chunks: string[] = []
  const pending = pluginHost.run(['install', '--global', '9router@0.5.109'], text => chunks.push(text))
  let settled = false
  void pending.then(() => { settled = true }, () => { settled = true })
  exec.child.stdout.emit('data', 'downloading\n')
  exec.child.stderr.emit('data', 'npm WARN example\n')
  expect(chunks[0]).toBe('$ npm install --global 9router@0.5.109\n')
  expect(chunks[1]).toContain('install timeout: 900000 ms')
  expect(chunks.slice(2)).toEqual(['downloading\n', 'npm WARN example\n'])
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
    [`${bin}\\pi-launcher.js`]: '// versioned installer launcher',
    ['C:\\Users\\Alice Smith\\.pi\\agent\\install\\current-version']: '1.4.0\r\n',
    ['C:\\Users\\Alice Smith\\.pi\\agent\\install\\releases\\1.4.0\\node_modules\\@earendil-works\\pi-coding-agent\\package.json']: JSON.stringify({ name: '@earendil-works/pi-coding-agent', version: '1.4.0' })
  }
  await expect(piPluginHost.detect()).resolves.toEqual({ installed: true, installedVersion: '1.4.0', executable: `${bin}\\pi.cmd`, managed: false, installationKind: 'pi-windows-installer' })
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


it('uses a generous bounded configurable install timeout', () => {
  expect(installTimeout({})).toBe(900_000)
  expect(installTimeout({ SHUMORA_INSTALL_TIMEOUT_MS: '1800000' })).toBe(1_800_000)
  for (const value of ['0', '-1', 'NaN', '999999999', '1.5']) expect(installTimeout({ SHUMORA_INSTALL_TIMEOUT_MS: value })).toBe(900_000)
})
it.each([false, true])('verifies Bun global Pi independently of PATH and reports shadowing: %s', async conflict => {
  vi.spyOn(process, 'platform', 'get').mockReturnValue('win32')
  vi.stubEnv('PI_EXECUTABLE', '')
  vi.stubEnv('BUN_INSTALL', 'C:\\Bun')
  vi.stubEnv('BUN_INSTALL_GLOBAL_DIR', '')
  vi.stubEnv('PATH', 'C:\\tools')
  const bin = 'C:\\Bun\\bin'
  const packageDir = 'C:\\Bun\\install\\global\\node_modules\\@earendil-works\\pi-coding-agent'
  exec.files = {
    ['C:\\tools\\bun.exe']: '',
    [`${bin}\\pi.exe`]: '',
    [`${packageDir}\\package.json`]: JSON.stringify({ name: '@earendil-works/pi-coding-agent', version: '1.4.0' }),
    ...(conflict ? { ['C:\\tools\\pi.exe']: '' } : {})
  }
  exec.responses['pm bin --global'] = bin
  exec.responses['--version'] = '1.4.0'
  exec.child = { stdout: new EventEmitter(), stderr: new EventEmitter() }
  if (conflict) {
    await expect(piPluginHost.verify!('bun', '1.4.0')).rejects.toThrow('shadows it on PATH')
    expect(process.env.PATH).toBe('C:\\tools')
  } else {
    await expect(piPluginHost.verify!('bun', '1.4.0')).resolves.toBeUndefined()
    expect(process.env.PATH).toContain(bin)
    await expect(piPluginHost.detect()).resolves.toMatchObject({ installed: true, installedVersion: '1.4.0', executable: `${bin}\\pi.exe`, packageManager: 'bun', managed: true })
  }
})
