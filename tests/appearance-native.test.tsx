// @vitest-environment jsdom
import React from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { AppearanceProvider, useAppearance } from '../src/renderer/src/Appearance'
afterEach(() => { cleanup(); delete (window as any).appearance; vi.unstubAllGlobals() })
function Controls() { const { setTheme } = useAppearance(); return <><button onClick={() => setTheme('auto')}>Auto</button><button onClick={() => setTheme('light')}>Light</button></> }
it('uses native OS dark mode even if renderer media reports light, and follows native changes', async () => {
  let listener = (_dark: boolean) => {}
  const off = vi.fn()
  ;(window as any).appearance = { systemDark: async () => true, onSystemTheme: (cb: typeof listener) => { listener = cb; return off } }
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }))
  render(<AppearanceProvider><Controls /></AppearanceProvider>)
  fireEvent.click(screen.getByText('Auto'))
  await waitFor(() => expect(document.documentElement.classList.contains('dark')).toBe(true))
  act(() => listener(false))
  expect(document.documentElement.classList.contains('light')).toBe(true)
  fireEvent.click(screen.getByText('Light'))
  act(() => listener(true))
  expect(document.documentElement.classList.contains('light')).toBe(true)
  expect(off).toHaveBeenCalled()
})
it('does not let a stale snapshot overwrite a newer native theme event', async () => {
  let finish!: (dark: boolean) => void
  let listener = (_dark: boolean) => {}
  ;(window as any).appearance = { systemDark: () => new Promise<boolean>(resolve => { finish = resolve }), onSystemTheme: (cb: typeof listener) => { listener = cb; return () => {} } }
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }))
  render(<AppearanceProvider><Controls /></AppearanceProvider>)
  fireEvent.click(screen.getByText('Auto'))
  act(() => listener(true))
  await act(async () => finish(false))
  expect(document.documentElement.classList.contains('dark')).toBe(true)
})
