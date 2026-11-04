import { expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { parseTheme, loadThemes, saveThemes } from '../src/renderer/src/local-themes'
const template = readFileSync('docs/theme-template.json', 'utf8')
it('accepts the documented declarative template', () => {
  const theme = parseTheme(template)
  expect(theme.format).toBe('shumora-theme/v1')
  expect(theme.id).toBe('ocean-dusk')
  expect(theme.colors.surface).toMatch(/^#[0-9a-f]{6}$/)
})
it('rejects CSS injection, unknown fields and incomplete palettes', () => {
  const input = JSON.parse(template)
  expect(() => parseTheme(JSON.stringify({ ...input, script: 'alert(1)' }))).toThrow()
  expect(() => parseTheme(JSON.stringify({ ...input, colors: { ...input.colors, surface: 'url(https://evil.test)' } }))).toThrow()
  expect(() => parseTheme(JSON.stringify({ ...input, colors: { ...input.colors, custom: '#ffffff' } }))).toThrow()
  delete input.colors.surface
  expect(() => parseTheme(JSON.stringify(input))).toThrow()
  expect(() => parseTheme(' '.repeat(65537))).toThrow()
})
it('ignores corrupted persistence and bounds installed themes', () => {
  let stored = '{broken'
  vi.stubGlobal('localStorage', { getItem: () => stored, setItem: (_: string, value: string) => { stored = value } })
  try {
    expect(loadThemes()).toEqual([])
    saveThemes([parseTheme(template)])
    expect(loadThemes()).toHaveLength(1)
    expect(() => saveThemes(Array(21).fill(parseTheme(template)))).toThrow()
  } finally { vi.unstubAllGlobals() }
})
