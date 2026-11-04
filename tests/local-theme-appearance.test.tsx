// @vitest-environment jsdom
import React from 'react'
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { act, cleanup, render } from '@testing-library/react'
import { AppearanceProvider, useAppearance } from '../src/renderer/src/Appearance'
import { parseTheme } from '../src/renderer/src/local-themes'
import { readFileSync } from 'node:fs'
const theme = parseTheme(readFileSync('docs/theme-template.json', 'utf8'))
let settings = null as ReturnType<typeof useAppearance> | null
function Observer() { settings = useAppearance(); return null }
beforeEach(() => {
  const store = new Map<string, string>()
  vi.stubGlobal('localStorage', { getItem: (key: string) => store.get(key) ?? null, setItem: (key: string, value: string) => store.set(key, value) })
})
afterEach(() => { cleanup(); settings = null; vi.unstubAllGlobals(); document.documentElement.removeAttribute('style') })
it('installs without applying, activates on selection, persists, and restores built-in colors', () => {
  render(<AppearanceProvider><Observer /></AppearanceProvider>)
  act(() => settings!.installTheme(theme))
  expect(document.documentElement.style.getPropertyValue('--surface')).toBe('')
  act(() => settings!.selectLocalTheme(theme.id))
  expect(document.documentElement.style.getPropertyValue('--surface')).toBe('#17212b')
  expect(document.documentElement.classList.contains('dark')).toBe(true)
  expect(settings!.activeLocalTheme).toBe(theme.id)
  act(() => settings!.setTheme('light'))
  expect(document.documentElement.style.getPropertyValue('--surface')).toBe('')
  act(() => settings!.selectLocalTheme(theme.id))
  act(() => settings!.removeTheme(theme.id))
  expect(document.documentElement.style.getPropertyValue('--surface')).toBe('')
  expect(settings!.activeLocalTheme).toBeNull()
})
