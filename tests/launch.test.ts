import { expect, it } from 'vitest'
import { resolveLaunch } from '../src/main/launch'
it('uses explicit executable without shell interpolation', () => {
  expect(resolveLaunch('linux', { PI_EXECUTABLE: '/opt/Pi App/pi' }, '/bin')).toEqual({ file: '/opt/Pi App/pi', args: [] })
})
it('finds pi on PATH and explains a missing installation', () => {
  expect(resolveLaunch('linux', {}, '/usr/bin', (p) => p === '/usr/bin/pi')).toEqual({ file: '/usr/bin/pi', args: [] })
  expect(() => resolveLaunch('linux', {}, '/empty', () => false)).toThrow(/Pi executable not found/)
})
it('uses a node-backed npm shim on Windows without passing a command string to cmd', () => {
  const paths = ['C:\\npm\\pi.cmd', 'C:\\npm\\node_modules\\@earendil-works\\pi-coding-agent\\dist\\cli.js', 'C:\\npm\\node.exe']
  expect(resolveLaunch('win32', {}, 'C:\\npm', (p) => paths.includes(p))).toEqual({ file: 'C:\\npm\\node.exe', args: [paths[1]] })
})
it('rejects unsupported Windows command shims clearly', () => {
  expect(() => resolveLaunch('win32', { PI_EXECUTABLE: 'C:\\pi.cmd' }, '', () => false)).toThrow(/PI_NODE_EXECUTABLE/)
})

it('finds pi in fallback dirs when GUI PATH is minimal (mac/linux)', () => {
  expect(resolveLaunch('darwin', { HOME: '/Users/a' }, '/usr/bin:/bin', (p) => p === '/opt/homebrew/bin/pi')).toEqual({ file: '/opt/homebrew/bin/pi', args: [] })
  expect(resolveLaunch('linux', { HOME: '/home/a' }, '/usr/bin', (p) => p === '/home/a/.bun/bin/pi')).toEqual({ file: '/home/a/.bun/bin/pi', args: [] })
})
it('falls back to login shell PATH', () => {
  expect(resolveLaunch('darwin', { HOME: '/Users/a' }, '', (p) => p === '/x/nvm/bin/pi', () => '/x/nvm/bin')).toEqual({ file: '/x/nvm/bin/pi', args: [] })
})
it('finds Windows cli.js under APPDATA when shim dir differs', () => {
  const env = { APPDATA: 'C:\\U\\AppData\\Roaming', ProgramFiles: 'C:\\Program Files' }
  const ok = ['C:\\U\\AppData\\Roaming\\npm\\pi.cmd', 'C:\\Program Files\\nodejs\\node.exe', 'C:\\U\\AppData\\Roaming\\npm\\node_modules\\@earendil-works\\pi-coding-agent\\dist\\cli.js']
  expect(resolveLaunch('win32', env, '', (p) => ok.includes(p))).toEqual({ file: ok[1], args: [ok[2]] })
})

it('launches the official Windows managed installer with its launcher and bundled Node', () => {
  const home = 'C:\\Users\\Alice Smith'
  const local = `${home}\\AppData\\Local`
  const bin = `${home}\\.pi\\agent\\bin`
  const files = [bin, `${bin}\\pi.cmd`, `${bin}\\pi-launcher.js`, `${local}\\pi-node\\current`, `${local}\\pi-node\\current\\node.exe`]
  const env = { USERPROFILE: home, LOCALAPPDATA: local }
  expect(resolveLaunch('win32', env, '', p => files.includes(p))).toEqual({ file: files[4], args: [files[2]] })
  expect(enrichedPath('win32', env, p => files.includes(p))).toContain(bin)
})
it('prefers the managed launcher over an unrelated global npm CLI', () => {
  const bin = 'C:\\Users\\a\\.pi\\agent\\bin'
  const files = [`${bin}\\pi.cmd`, `${bin}\\pi-launcher.js`, 'C:\\node\\node.exe', 'C:\\npm\\node_modules\\@earendil-works\\pi-coding-agent\\dist\\cli.js']
  expect(resolveLaunch('win32', { PI_EXECUTABLE: files[0], APPDATA: 'C:\\unused' }, 'C:\\node;C:\\npm', p => files.includes(p))).toEqual({ file: files[2], args: [files[1]] })
})
import { enrichedPath, windowsPiPackageCandidates } from '../src/main/launch'
it('reads managed package metadata from the active release and rejects traversal versions', () => {
  const bin = 'C:\\Users\\a\\.pi\\agent\\bin'
  const marker = 'C:\\Users\\a\\.pi\\agent\\install\\current-version'
  expect(windowsPiPackageCandidates({}, bin, p => { expect(p).toBe(marker); return '1.4.0\r\n' })).toContain('C:\\Users\\a\\.pi\\agent\\install\\releases\\1.4.0\\node_modules\\@earendil-works\\pi-coding-agent\\package.json')
  for (const version of ['..', '../outside', 'C:\\outside']) expect(windowsPiPackageCandidates({}, bin, () => version).some(p => p.includes('releases'))).toBe(false)
})
it('enrichedPath appends existing fallback and shell dirs without duplicates', () => {
  const ok = ['/opt/homebrew/bin', '/x/nvm/bin', '/usr/bin']
  expect(enrichedPath('darwin', { HOME: '/Users/a', PATH: '/usr/bin:/bin' }, (p) => ok.includes(p), () => '/x/nvm/bin:/usr/bin')).toBe('/usr/bin:/bin:/x/nvm/bin:/opt/homebrew/bin')
})
