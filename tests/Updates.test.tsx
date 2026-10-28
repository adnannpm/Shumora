// @vitest-environment jsdom
import React from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
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
it('uses real updater events for download progress and does not expose simulation controls', async () => {
  let listener = (_: UpdateState) => {}
  window.updates = { status: async () => ({ status: 'available', currentVersion: '1.0.0', version: '1.0.1' }), onState: cb => { listener = cb; return () => {} }, check: vi.fn(async () => {}), download: vi.fn(async () => {
    listener({ status: 'downloading', currentVersion: '1.0.0', version: '1.0.1', percent: 42 })
  }), install: vi.fn(async () => {}) }
  render(<Provider><Updates /></Provider>)
  const download = await screen.findByRole('button', { name: 'Download update' })
  expect(screen.queryByRole('button', { name: 'Simulate update' })).toBeNull()
  expect(download.classList.contains('update-primary-action')).toBe(true)
  fireEvent.click(download)
  await waitFor(() => expect(screen.getByRole('progressbar').getAttribute('value')).toBe('42'))
  expect(window.updates.download).toHaveBeenCalledOnce()
  expect(screen.getByRole('region', { name: 'Update download' }).textContent).toContain('You can keep working while the update downloads.')
  await act(async () => { listener({ status: 'downloaded', currentVersion: '1.0.0', version: '1.0.1', percent: 100 }) })
  const downloadCard = screen.getByRole('region', { name: 'Update download' })
  expect(screen.queryByRole('button', { name: 'Check for updates' })).toBeNull()
  expect(downloadCard.textContent).toContain('100%')
  expect(downloadCard.textContent).toContain('Update ready to install')
  expect(downloadCard.contains(screen.getByRole('button', { name: 'Restart & install' }))).toBe(true)
})
it('disables update controls for development and unsupported installations', async () => {
  window.updates = { status: async () => ({ status: 'unsupported', currentVersion: '0.1.0', reason: 'Packaged builds only' }), onState: () => () => {} } as any
  render(<Provider><Updates /></Provider>)
  await screen.findByText('Packaged builds only')
  expect((screen.getByRole('button', { name: 'Check for updates' }) as HTMLButtonElement).disabled).toBe(true)
})
