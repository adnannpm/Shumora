// @vitest-environment jsdom
import React from 'react'
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { AppearanceProvider } from '../src/renderer/src/Appearance'
import { ThemeAddons } from '../src/renderer/src/ThemeAddons'
import { Library } from '../src/renderer/src/Library'
import { Provider } from '../src/renderer/src/Provider'
import { readFileSync } from 'node:fs'
const template = readFileSync('docs/theme-template.json', 'utf8')
beforeEach(() => {
  const data = new Map<string, string>()
  vi.stubGlobal('localStorage', { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => data.set(key, value) })
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
})
afterEach(() => { cleanup(); vi.unstubAllGlobals(); document.documentElement.removeAttribute('style') })
it('previews imported theme without applying until installed and activated, then restores built-in appearance', async () => {
  render(<AppearanceProvider><ThemeAddons /></AppearanceProvider>)
  fireEvent.change(screen.getByLabelText('Import theme JSON'), { target: { files: [new File([template], 'ocean.json', { type: 'application/json' })] } })
  expect(await screen.findByText('Ocean Dusk')).toBeTruthy()
  expect(document.documentElement.style.getPropertyValue('--surface')).toBe('')
  fireEvent.click(screen.getByRole('button', { name: 'Install theme' }))
  fireEvent.click(screen.getByRole('button', { name: 'Activate Ocean Dusk' }))
  await waitFor(() => expect(document.documentElement.style.getPropertyValue('--surface')).toBe('#17212b'))
  fireEvent.click(screen.getByRole('button', { name: 'Use built-in theme' }))
  await waitFor(() => expect(document.documentElement.style.getPropertyValue('--surface')).toBe(''))
  fireEvent.click(screen.getByRole('button', { name: 'Remove Ocean Dusk' }))
  expect(screen.queryByRole('button', { name: 'Activate Ocean Dusk' })).toBeNull()
})
it('returns to the previously selected built-in dark mode after trying a custom theme', async () => {
  localStorage.setItem('shumora.theme', 'dark')
  render(<AppearanceProvider><ThemeAddons /></AppearanceProvider>)
  fireEvent.change(screen.getByLabelText('Import theme JSON'), { target: { files: [new File([template], 'ocean.json', { type: 'application/json' })] } })
  fireEvent.click(await screen.findByRole('button', { name: 'Install theme' }))
  fireEvent.click(screen.getByRole('button', { name: 'Activate Ocean Dusk' }))
  await waitFor(() => expect(document.documentElement.style.getPropertyValue('--surface')).toBe('#17212b'))
  fireEvent.click(screen.getByRole('button', { name: 'Use built-in theme' }))
  await waitFor(() => expect(document.documentElement.style.getPropertyValue('--surface')).toBe(''))
  expect(document.documentElement.classList.contains('dark')).toBe(true)
  expect(localStorage.getItem('shumora.theme')).toBe('dark')
})
it('exposes the Add-ons theme gallery from the Library navigation', async () => {
  render(<Provider><Library /></Provider>)
  fireEvent.click(screen.getByRole('tab', { name: 'Add-ons' }))
  expect(await screen.findByRole('heading', { name: 'Themes' })).toBeTruthy()
  expect(screen.getByLabelText('Import theme JSON')).toBeTruthy()
})
it('rejects invalid imports without altering installed themes', async () => {
  render(<AppearanceProvider><ThemeAddons /></AppearanceProvider>)
  fireEvent.change(screen.getByLabelText('Import theme JSON'), { target: { files: [new File(['{"bad":true}'], 'bad.json')] } })
  expect(await screen.findByRole('alert')).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Install theme' })).toBeNull()
})
