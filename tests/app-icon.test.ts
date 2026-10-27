import { expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import config from '../package.json'
it('packages Shumora icons for Linux, Windows and macOS rather than Electron defaults', () => {
  const build = config.build as any
  expect(build.linux.icon).toBe('resources/icons/icon.png')
  expect(build.mac.icon).toBe('resources/icons/icon.png')
  expect(build.win.icon).toBe('resources/icons/icon.ico')
  expect(build.win.signAndEditExecutable).not.toBe(false)
  expect(build.files).toContain('resources/icons/**/*')
  const png = readFileSync(build.linux.icon)
  expect(png.subarray(1, 4).toString()).toBe('PNG')
  expect(png.readUInt32BE(16)).toBe(1024)
  expect(png.readUInt32BE(20)).toBe(1024)
  const ico = readFileSync(build.win.icon)
  expect(ico.readUInt16LE(2)).toBe(1)
  expect(ico.readUInt16LE(4)).toBeGreaterThan(1)
})
