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

import { enrichedPath } from '../src/main/launch'
it('enrichedPath appends existing fallback and shell dirs without duplicates', () => {
  const ok = ['/opt/homebrew/bin', '/x/nvm/bin', '/usr/bin']
  expect(enrichedPath('darwin', { HOME: '/Users/a', PATH: '/usr/bin:/bin' }, (p) => ok.includes(p), () => '/x/nvm/bin:/usr/bin')).toBe('/usr/bin:/bin:/x/nvm/bin:/opt/homebrew/bin')
})
