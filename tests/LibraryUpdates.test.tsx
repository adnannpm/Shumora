// @vitest-environment jsdom
import React from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { Provider } from '../src/renderer/src/Provider'
import { LibraryUpdates } from '../src/renderer/src/LibraryUpdates'
afterEach(cleanup)
it('shows a combined count and opens the selected package or plugin', async () => {
  window.packages = { updates: async () => ({ items: [{ kind: 'package', id: 'tools', name: 'tools', installedVersion: '1.0.0', latestVersion: '2.0.0' }, { kind: 'plugin', id: 'pi', name: 'Pi', installedVersion: '1.0.0', latestVersion: '1.1.0' }], errors: [] }) } as any
  const open = vi.fn()
  render(<Provider><LibraryUpdates onView={open} /></Provider>)
  await screen.findByText('2 updates available')
  fireEvent.click(screen.getByRole('button', { name: 'Update details' }))
  fireEvent.click(await screen.findByRole('button', { name: 'View update for Pi' }))
  expect(open).toHaveBeenCalledWith(expect.objectContaining({ kind: 'plugin', id: 'pi' }))
})
