// @vitest-environment jsdom
import React from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Provider } from '../src/renderer/src/Provider'
import { Packages } from '../src/renderer/src/Packages'
afterEach(cleanup)
it('loads real catalog data and requires confirmation for global installation', async () => {
  const install = vi.fn(async () => ({ status: 'success', output: 'installed' }))
  window.packages = { status: async () => ({ configured: false, installed: false }), mutate: install, catalog: async () => ({ items: [{ name: 'demo-tools', description: 'Tools', author: 'Demo', types: ['extension'], downloads: 10, version: '1.2.3' }], page: 1, pages: 2 }), install, operation: async () => ({ status: 'idle', output: '' }), onOperation: () => () => {} } as any
  render(<Provider><Packages banner={<div>Updates banner</div>} /></Provider>)
  expect(screen.getByText('Updates banner')).toBeTruthy()
  fireEvent.click(await screen.findByRole('button', { name: 'View demo-tools' }))
  expect(screen.queryByText('Updates banner')).toBeNull()
  fireEvent.click(await screen.findByRole('button', { name: 'Install globally' }))
  expect(install).not.toHaveBeenCalled()
  fireEvent.click(await screen.findByRole('button', { name: 'Confirm install' }))
  await waitFor(() => expect(install).toHaveBeenCalledWith('install', 'demo-tools', '1.2.3'))
  expect(screen.getByRole('log').textContent).toContain('installed')
  fireEvent.click(screen.getByRole('button', { name: 'Back to packages' }))
  expect(screen.getByText('Updates banner')).toBeTruthy()
  fireEvent.click(await screen.findByRole('button', { name: 'View demo-tools' }))
  expect(screen.getByRole('log').textContent).not.toContain('installed')
  expect(screen.getByRole('log').textContent).toContain('No package operation yet.')
})
