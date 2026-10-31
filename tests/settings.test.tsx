// @vitest-environment jsdom
import React from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { JSDOM } from 'jsdom'
beforeEach(() => {
  const storage = new JSDOM('', { url: 'https://shumora.test' }).window.localStorage
  Object.defineProperty(window, 'localStorage', { configurable: true, value: storage })
})
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { Provider } from '../src/renderer/src/Provider'
import { Settings } from '../src/renderer/src/Settings'
afterEach(() => { cleanup(); vi.unstubAllGlobals(); window.localStorage.clear(); document.documentElement.classList.remove('dark', 'light') })
it('switches and persists app theme, restores it on remount, and keeps terminal preference separate', () => {
  const view = render(<Provider><Settings /></Provider>)
  expect(screen.getByRole('radio', { name: 'Light' }).getAttribute('aria-checked')).toBe('true')
  fireEvent.click(screen.getByRole('radio', { name: 'Dark' }))
  expect(document.documentElement.classList.contains('dark')).toBe(true)
  expect(window.localStorage.getItem('shumora.theme')).toBe('dark')
  view.unmount(); render(<Provider><Settings /></Provider>)
  expect(screen.getByRole('radio', { name: 'Dark' }).getAttribute('aria-checked')).toBe('true')
  fireEvent.click(screen.getByRole('button', { name: 'Workspace' }))
  expect(screen.getByText('Always dark')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'About & Updates' }))
  expect(screen.getByRole('heading', { name: 'About & Updates' })).toBeTruthy()
})
it('groups settings into consistent pages including Storage with troubleshooting inside Workspace', () => {
  const view = render(<Provider><Settings /></Provider>)
  const nav = screen.getByRole('navigation', { name: 'Settings sections' })
  expect([...nav.querySelectorAll('button')].map(button => button.textContent)).toEqual(['General', 'Workspace', 'Storage', 'About & Updates'])
  const content = view.container.querySelector('.settings-content')!
  for (const name of ['General', 'Workspace', 'About & Updates']) {
    fireEvent.click(screen.getByRole('button', { name }))
    expect(content.classList.contains('settings-content-wide')).toBe(true)
    expect(content.querySelectorAll('h2')).toHaveLength(1)
  }
  fireEvent.click(screen.getByRole('button', { name: 'Workspace' }))
  expect(screen.getByRole('button', { name: 'Run diagnostics' })).toBeTruthy()
  expect(screen.getByRole('heading', { name: 'Troubleshooting' })).toBeTruthy()
})
function mockSystemTheme(dark: boolean) {
  const changes = new EventTarget()
  const media = Object.assign(changes, { matches: dark, media: '(prefers-color-scheme: dark)' })
  vi.stubGlobal('matchMedia', (query: string) => {
    expect(query).toBe('(prefers-color-scheme: dark)')
    return media
  })
  return (matches: boolean) => act(() => {
    media.matches = matches
    media.dispatchEvent(Object.assign(new Event('change'), { matches }))
  })
}
it('auto follows OS changes, persists the preference, and restores it on remount', () => {
  const changeSystemTheme = mockSystemTheme(true)
  const view = render(<Provider><Settings /></Provider>)
  fireEvent.click(screen.getByRole('radio', { name: 'Auto' }))
  expect(document.documentElement.classList.contains('dark')).toBe(true)
  expect(document.documentElement.style.colorScheme).toBe('dark')
  expect(window.localStorage.getItem('shumora.theme')).toBe('auto')
  changeSystemTheme(false)
  expect(document.documentElement.classList.contains('light')).toBe(true)
  expect(document.documentElement.classList.contains('dark')).toBe(false)
  expect(document.documentElement.style.colorScheme).toBe('light')
  expect(screen.getByRole('radio', { name: 'Auto' }).getAttribute('aria-checked')).toBe('true')
  view.unmount()
  changeSystemTheme(true)
  render(<Provider><Settings /></Provider>)
  expect(screen.getByRole('radio', { name: 'Auto' }).getAttribute('aria-checked')).toBe('true')
  expect(document.documentElement.classList.contains('dark')).toBe(true)
})
it('manual themes ignore OS changes after leaving auto', () => {
  const changeSystemTheme = mockSystemTheme(true)
  render(<Provider><Settings /></Provider>)
  fireEvent.click(screen.getByRole('radio', { name: 'Auto' }))
  fireEvent.click(screen.getByRole('radio', { name: 'Light' }))
  changeSystemTheme(false)
  changeSystemTheme(true)
  expect(document.documentElement.classList.contains('light')).toBe(true)
  fireEvent.click(screen.getByRole('radio', { name: 'Dark' }))
  changeSystemTheme(false)
  expect(document.documentElement.classList.contains('dark')).toBe(true)
  expect(window.localStorage.getItem('shumora.theme')).toBe('dark')
})
it('navigates all three theme options with arrow keys and Home/End', () => {
  mockSystemTheme(false)
  render(<Provider><Settings /></Provider>)
  const light = screen.getByRole('radio', { name: 'Light' })
  const dark = screen.getByRole('radio', { name: 'Dark' })
  const auto = screen.getByRole('radio', { name: 'Auto' })
  for (const [from, key, to] of [[light, 'ArrowRight', dark], [dark, 'ArrowDown', auto], [auto, 'ArrowRight', light], [light, 'ArrowLeft', auto], [auto, 'ArrowUp', dark], [dark, 'End', auto], [auto, 'Home', light]] as const) {
    fireEvent.keyDown(from, { key })
    expect(document.activeElement).toBe(to)
    expect(to.getAttribute('aria-checked')).toBe('true')
    expect(to.tabIndex).toBe(0)
  }
})
it('falls back to light for invalid stored theme', () => {
  window.localStorage.setItem('shumora.theme', 'unknown')
  render(<Provider><Settings /></Provider>)
  expect(screen.getByRole('radio', { name: 'Light' }).getAttribute('aria-checked')).toBe('true')
})
