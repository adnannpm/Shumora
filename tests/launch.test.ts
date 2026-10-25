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
