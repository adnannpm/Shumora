import { expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { openFolderArgument } from '../src/main/open-folder'
it('accepts only an explicit absolute existing folder without evaluating shell syntax', () => {
  const folder = 'C:\\Work & Projects\\sample'
  expect(openFolderArgument(['Shumora.exe', '--open-folder', folder], 'win32', p => p === folder)).toBe(folder)
  expect(openFolderArgument(['Shumora.exe', '--open-folder', 'C:\\'], 'win32', () => true)).toBe('C:\\')
  for (const args of [[], ['--open-folder'], ['--open-folder', '--other'], ['--open-folder', '..'], ['--open-folder', 'C:\\missing']]) {
    expect(() => openFolderArgument(args, 'win32', () => false)).not.toThrow()
    expect(openFolderArgument(args, 'win32', () => false)).toBeUndefined()
  }
})
it('registers quoted folder and background Explorer commands and removes both on uninstall', () => {
  const config = JSON.parse(readFileSync('package.json', 'utf8'))
  expect(config.build.nsis.include).toBe('resources/windows-context-menu.nsh')
  const script = readFileSync(config.build.nsis.include, 'utf8')
  for (const key of ['Directory\\shell\\Shumora', 'Directory\\Background\\shell\\Shumora']) {
    expect(script).toContain(`Software\\Classes\\${key}`)
    expect(script).toContain(`DeleteRegKey SHELL_CONTEXT "Software\\Classes\\${key}"`)
  }
  expect(script).toContain('--open-folder $\\"%1$\\"')
  expect(script).toContain('--open-folder $\\"%V$\\"')
})
