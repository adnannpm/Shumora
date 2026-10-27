// @vitest-environment jsdom
import React from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Provider } from '../src/renderer/src/Provider'
import { Library } from '../src/renderer/src/Library'
beforeEach(() => vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} }))
afterEach(() => { cleanup(); vi.unstubAllGlobals() })
it('opens Pi details from Library without creating an integration menu', async () => {
  window.piPlugin = { status: async () => ({ id: 'pi', name: 'Pi', installed: false, latestVersion: '1.0.0', busy: false }), operation: async () => ({ status: 'idle', output: '' }), onOperation: () => () => {} } as any
  render(<Provider><Library /></Provider>)
  fireEvent.click(screen.getByRole('tab', { name: 'Plugins' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Open Pi plugin' }))
  expect(screen.getByRole('heading', { name: 'Pi plugin', level: 1 })).toBeTruthy()
  await screen.findByRole('button', { name: 'Install' })
  fireEvent.click(screen.getByRole('button', { name: 'Back to plugins' }))
  expect(screen.getByRole('tab', { name: 'Plugins' }).getAttribute('aria-selected')).toBe('true')
})
it('shows Packages and Plugins as accessible tabs with separate empty panels', async () => {
  render(<Provider><Library /></Provider>)
  expect(screen.getByRole('tab', { name: 'Packages' }).getAttribute('aria-selected')).toBe('true')
  expect(screen.getByRole('tabpanel', { name: 'Packages' }).textContent).toContain('Pi Packages')
  fireEvent.click(screen.getByRole('tab', { name: 'Plugins' }))
  await waitFor(() => expect(screen.getByRole('tab', { name: 'Plugins' }).getAttribute('aria-selected')).toBe('true'))
  fireEvent.click(screen.getByRole('button', { name: 'Open 9router plugin' }))
  expect(screen.getByRole('heading', { name: '9router plugin', level: 1 })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Back to plugins' }))
  expect(screen.getByRole('tab', { name: 'Plugins' }).getAttribute('aria-selected')).toBe('true')
})
it('opens a package detail as a standalone page outside the Library tab shell', async () => {
  window.packages = { status: async () => ({ configured: false, installed: false }), catalog: async () => ({ items: [{ name: 'demo-tools', description: 'Tools', author: 'Demo', types: ['extension'], downloads: 10, version: '1.2.3' }], page: 1, pages: 1 }), onOperation: () => () => {} } as any
  render(<Provider><Library /></Provider>)
  fireEvent.click(await screen.findByRole('button', { name: 'View demo-tools' }))
  expect(screen.getByRole('heading', { name: 'demo-tools', level: 1 })).toBeTruthy()
  expect(screen.queryByRole('heading', { name: 'Library' })).toBeNull()
  expect(screen.queryByRole('tab', { name: 'Packages' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Back to packages' }))
  expect(screen.getByRole('heading', { name: 'Library' })).toBeTruthy()
  expect(await screen.findByRole('button', { name: 'View demo-tools' })).toBeTruthy()
})
