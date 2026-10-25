// @vitest-environment jsdom
import React from 'react'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { JSDOM } from 'jsdom'
beforeEach(() => {
  const storage = new JSDOM('', { url: 'https://shumora.test' }).window.localStorage
  Object.defineProperty(window, 'localStorage', { configurable: true, value: storage })
})
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { Provider } from '../src/renderer/src/Provider'
import { Settings } from '../src/renderer/src/Settings'
afterEach(() => { cleanup(); window.localStorage.clear(); document.documentElement.classList.remove('dark', 'light') })
it('switches and persists app theme, restores it on remount, and keeps terminal preference separate', () => {
  const view = render(<Provider><Settings /></Provider>)
  expect(screen.getByRole('radio', { name: 'Light' }).getAttribute('aria-checked')).toBe('true')
  fireEvent.click(screen.getByRole('radio', { name: 'Dark' }))
  expect(document.documentElement.classList.contains('dark')).toBe(true)
  expect(window.localStorage.getItem('shumora.theme')).toBe('dark')
  view.unmount(); render(<Provider><Settings /></Provider>)
  expect(screen.getByRole('radio', { name: 'Dark' }).getAttribute('aria-checked')).toBe('true')
  fireEvent.click(screen.getByRole('button', { name: 'Terminal' }))
  expect(screen.getByText('Always dark')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'About' }))
  expect(screen.getByRole('heading', { name: 'About Shumora' })).toBeTruthy()
})
it('falls back to light for invalid stored theme', () => {
  window.localStorage.setItem('shumora.theme', 'unknown')
  render(<Provider><Settings /></Provider>)
  expect(screen.getByRole('radio', { name: 'Light' }).getAttribute('aria-checked')).toBe('true')
})
