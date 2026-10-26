// @vitest-environment jsdom
import React from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Provider } from '../src/renderer/src/Provider'
import { Library } from '../src/renderer/src/Library'
beforeEach(() => vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} }))
afterEach(() => { cleanup(); vi.unstubAllGlobals() })
it('shows Package and Plugin as accessible tabs with separate empty panels', async () => {
  render(<Provider><Library /></Provider>)
  expect(screen.getByRole('tab', { name: 'Package' }).getAttribute('aria-selected')).toBe('true')
  expect(screen.getByRole('tabpanel', { name: 'Package' }).textContent).toContain('No packages yet')
  fireEvent.click(screen.getByRole('tab', { name: 'Plugin' }))
  await waitFor(() => expect(screen.getByRole('tab', { name: 'Plugin' }).getAttribute('aria-selected')).toBe('true'))
  fireEvent.click(screen.getByRole('button', { name: 'Open 9router plugin' }))
  expect(screen.getByRole('heading', { name: '9router plugin', level: 1 })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Back to plugins' }))
  expect(screen.getByRole('tab', { name: 'Plugin' }).getAttribute('aria-selected')).toBe('true')
})
