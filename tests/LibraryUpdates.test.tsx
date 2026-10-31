// @vitest-environment jsdom
import React from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Provider } from '../src/renderer/src/Provider'
import { LibraryUpdates } from '../src/renderer/src/LibraryUpdates'
afterEach(cleanup)
it('keeps loading and up-to-date feedback out of the header and allows a manual recheck', async () => {
  let finish!: (value: { items: []; errors: [] }) => void
  const updates = vi.fn().mockImplementationOnce(() => new Promise(resolve => { finish = resolve })).mockResolvedValue({ items: [{ kind: 'package', id: 'tools', name: 'tools', installedVersion: '1.0.0', latestVersion: '2.0.0' }], errors: [] })
  window.packages = { updates } as any
  render(<Provider><LibraryUpdates onView={() => {}} /></Provider>)
  expect(screen.queryByText('Checking Library updates')).toBeNull()
  expect(screen.getByRole('button', { name: 'Check updates' }).hasAttribute('disabled')).toBe(true)
  finish({ items: [], errors: [] })
  await waitFor(() => expect(screen.getByRole('button', { name: 'Check updates' }).hasAttribute('disabled')).toBe(false))
  expect(screen.queryByRole('button', { name: /Updates ·/ })).toBeNull()
  expect(screen.queryByText('All checked packages and plugins are up to date')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Check updates' }))
  expect(await screen.findByRole('button', { name: 'Updates · 1' })).toBeTruthy()
  expect(screen.getByRole('status').textContent).toBe('')
})
it('keeps failed checks discoverable through a compact details button', async () => {
  window.packages = { updates: async () => { throw new Error('Offline') } } as any
  render(<Provider><LibraryUpdates onView={() => {}} /></Provider>)
  fireEvent.click(await screen.findByRole('button', { name: 'Update check incomplete' }))
  expect(await screen.findByText('Could not check Library updates. Try again.')).toBeTruthy()
})
it('confirms a manual empty check without showing automatic success feedback', async () => {
  window.packages = { updates: async () => ({ items: [], errors: [] }) } as any
  render(<Provider><LibraryUpdates onView={() => {}} /></Provider>)
  await waitFor(() => expect(screen.getByRole('button', { name: 'Check updates' }).hasAttribute('disabled')).toBe(false))
  expect(screen.getByRole('status').textContent).toBe('')
  fireEvent.click(screen.getByRole('button', { name: 'Check updates' }))
  await waitFor(() => expect(screen.getByRole('status').textContent).toBe('All checked packages and plugins are up to date'))
  expect(screen.queryByRole('button', { name: /Updates ·/ })).toBeNull()
})
it('shows only nonempty counted update categories and explains the combined badge', async () => {
  window.packages = { updates: async () => ({ items: [{ kind: 'plugin', id: 'pi', name: 'Pi', installedVersion: '1.0.0', latestVersion: '1.1.0' }], errors: [] }) } as any
  render(<Provider><LibraryUpdates onView={() => {}} /></Provider>)
  const badge = await screen.findByRole('button', { name: 'Updates · 1' })
  expect(badge.getAttribute('title')).toBe('Updates across packages and plugins')
  fireEvent.click(badge)
  expect(await screen.findByRole('heading', { name: 'Plugins · 1' })).toBeTruthy()
  expect(screen.queryByRole('heading', { name: /Packages/ })).toBeNull()
})
it('announces manual partial failures instead of reporting everything up to date', async () => {
  window.packages = { updates: async () => ({ items: [], errors: ['Plugin check failed'] }) } as any
  render(<Provider><LibraryUpdates onView={() => {}} /></Provider>)
  await screen.findByRole('button', { name: 'Update check incomplete' })
  fireEvent.click(screen.getByRole('button', { name: 'Check updates' }))
  await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Update check incomplete'))
})
it('shows a combined count and opens the selected package or plugin', async () => {
  window.packages = { updates: async () => ({ items: [{ kind: 'package', id: 'tools', name: 'tools', installedVersion: '1.0.0', latestVersion: '2.0.0' }, { kind: 'plugin', id: 'pi', name: 'Pi', installedVersion: '1.0.0', latestVersion: '1.1.0' }], errors: [] }) } as any
  const open = vi.fn()
  render(<Provider><LibraryUpdates onView={open} /></Provider>)
  fireEvent.click(await screen.findByRole('button', { name: 'Updates · 2' }))
  fireEvent.click(await screen.findByRole('button', { name: 'View update for Pi' }))
  expect(open).toHaveBeenCalledWith(expect.objectContaining({ kind: 'plugin', id: 'pi' }))
})
