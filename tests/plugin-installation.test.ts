import { expect, it } from 'vitest'
import { windowsShimTargetsPackage, commandFailure } from '../src/main/plugin-installation'
it('recognizes npm cmd shims with spaces, mixed casing and relative package targets', () => {
  expect(windowsShimTargetsPackage('C:\\Users\\Alice Smith\\npm\\pi.cmd', '@"%dp0%\\node.exe" "%dp0%\\node_modules\\@earendil-works\\pi-coding-agent\\dist\\cli.js" %*', 'c:\\users\\alice smith\\npm\\node_modules\\@earendil-works\\pi-coding-agent')).toBe(true)
  expect(windowsShimTargetsPackage('C:\\bin\\pi.cmd', '@node "%dp0%\\..\\packages\\pi\\dist\\cli.js" %*', 'C:\\packages\\pi')).toBe(true)
  expect(windowsShimTargetsPackage('C:\\bin\\pi.cmd', '@node "%dp0%\\other\\dist\\cli.js" %*', 'C:\\packages\\pi')).toBe(false)
})
it('preserves exit codes, signals, stdout and stderr instead of blaming permissions', () => {
 const message = commandFailure(Object.assign(new Error('Command failed'), {code: 1, signal: null, killed: false}), 'npm ERR! detailed reason on stdout', 'npm warn deprecated')
 expect(message).toContain('Exit code: 1')
 expect(message).toContain('detailed reason on stdout')
 expect(message).toContain('npm warn deprecated')
 expect(commandFailure(Object.assign(new Error('timeout'), {killed: true, signal:'SIGTERM'}), '', '')).toContain('timeout')
})
