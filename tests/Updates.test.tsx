// @vitest-environment jsdom
import React from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Provider } from '../src/renderer/src/Provider'
import { Updates } from '../src/renderer/src/Updates'
import type { UpdateState } from '../src/shared/updates'
afterEach(cleanup)
it('checks, downloads and requires Shumora confirmation before installing', async () => {
  let listener = (_: UpdateState) => {}
  const state = { status: 'downloaded', currentVersion: '0.1.0', version: '0.2.0' } as const
  window.updates = { status: async () => state, onState: cb => { listener = cb; return () => {} }, check: vi.fn(async () => {}), download: vi.fn(async () => {}), install: vi.fn(async () => {}) }
  window.workspace = { list: async () => [{ status: 'running' }] } as any
  render(<Provider><Updates /></Provider>)
  fireEvent.click(await screen.findByRole('button', { name: 'Restart & install' }))
  await screen.findByRole('alertdialog')
  expect(screen.getByText(/1 Pi session/)).toBeTruthy()
  expect(window.updates.install).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
  await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
  fireEvent.click(screen.getByRole('button', { name: 'Restart & install' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Stop sessions and install' }))
  await waitFor(() => expect(window.updates.install).toHaveBeenCalledOnce())
})
it('disables update controls for development and unsupported installations', async () => {
  window.updates = { status: async () => ({ status: 'unsupported', currentVersion: '0.1.0', reason: 'Packaged builds only' }), onState: () => () => {} } as any
  render(<Provider><Updates /></Provider>)
  await screen.findByText('Packaged builds only')
  expect((screen.getByRole('button', { name: 'Check for updates' }) as HTMLButtonElement).disabled).toBe(true)
})
