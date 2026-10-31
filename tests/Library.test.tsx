// @vitest-environment jsdom
import React from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Provider } from '../src/renderer/src/Provider'
import { Library } from '../src/renderer/src/Library'
beforeEach(() => vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} }))
afterEach(() => { cleanup(); vi.unstubAllGlobals() })
it('opens package manager plugin details with the shared actions shell', async () => {
  window.managerPlugins = { status: async (id: string) => ({ id, name: id, installed: false, latestVersion: '1.0.0', availableManagers: ['npm'] }), onOperation: () => () => {} } as any
  render(<Provider><Library /></Provider>)
  fireEvent.click(screen.getByRole('tab', { name: 'Plugins' }))
  for (const name of ['pnpm', 'Bun', 'Yarn']) {
    fireEvent.click(await screen.findByRole('button', { name: `Open ${name} plugin` }))
    expect(screen.getByRole('heading', { name: `${name} plugin`, level: 1 })).toBeTruthy()
    expect(await screen.findByRole('button', { name: 'Install' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Back to plugins' }))
  }
})

it('renders local thumbnails for Pi, OpenCode and Node.js', async () => {
  render(<Provider><Library /></Provider>)
  fireEvent.click(screen.getByRole('tab', { name: 'Plugins' }))
  for (const name of ['Pi', 'OpenCode', 'Node.js']) {
    const image = await screen.findByRole('img', { name: `${name} thumbnail` })
    expect(image.getAttribute('src')).toMatch(/thumbnail\.svg/)
  }
})

it('shows Node.js and OpenCode plugins and opens their details', async () => {
  window.nodePlugin = { status: async () => ({ installed: true, installedVersion: '22.20.0', executable: '/bin/node' }) } as any
  window.opencodePlugin = { status: async () => ({ id: 'opencode', installed: false, latestVersion: '1.0.0' }), onOperation: () => () => {} } as any
  render(<Provider><Library /></Provider>)
  fireEvent.click(screen.getByRole('tab', { name: 'Plugins' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Open Node.js plugin' }))
  expect(await screen.findByText('22.20.0')).toBeTruthy()
  expect(screen.getByRole('link', { name: 'Download Node.js' }).getAttribute('href')).toBe('https://nodejs.org/en/download')
  expect(screen.queryByRole('button', { name: 'Uninstall' })).toBeNull()
  const refresh = screen.getByRole('button', { name: 'Refresh status' })
  expect(refresh.querySelector('svg')).toBeTruthy()
  expect(refresh.getAttribute('title')).toBe('Refresh status')
  expect(screen.getByRole('link', { name: 'Repository' }).getAttribute('href')).toBe('https://github.com/nodejs/node')
  expect(screen.getByRole('link', { name: 'Download Node.js' }).closest('footer')?.getAttribute('aria-label')).toBe('Plugin actions')
  expect(screen.getByRole('status').textContent).toContain('Installed · 22.20.0')
  fireEvent.click(screen.getByRole('button', { name: 'Back to plugins' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Open OpenCode plugin' }))
  expect(screen.getByRole('heading', { name: 'OpenCode plugin', level: 1 })).toBeTruthy()
  expect(await screen.findByRole('button', { name: 'Install' })).toBeTruthy()
})

it('keeps combined updates in the Library header across category switches', async () => {
  const updates = vi.fn().mockResolvedValue({ items: [{ kind: 'plugin', id: 'pi', name: 'Pi', installedVersion: '1.0.0', latestVersion: '2.0.0' }], errors: [] })
  window.packages = { updates, catalog: async () => ({ items: [], page: 1, pages: 1 }) } as any
  render(<Provider><Library /></Provider>)
  const badge = await screen.findByRole('button', { name: 'Updates · 1' })
  expect(badge.closest('header')).toBeTruthy()
  fireEvent.click(screen.getByRole('tab', { name: 'Plugins' }))
  await screen.findByRole('button', { name: 'Open Pi plugin' })
  expect(screen.getByRole('button', { name: 'Updates · 1' })).toBe(badge)
  expect(updates).toHaveBeenCalledTimes(1)
  expect(updates).toHaveBeenCalledWith(undefined)
})
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
