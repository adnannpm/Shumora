// @vitest-environment jsdom
import React from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Provider } from '../src/renderer/src/Provider'
import { UpdateNotification } from '../src/renderer/src/UpdateNotification'
import type { UpdateState } from '../src/shared/updates'

afterEach(() => { cleanup(); delete (window as any).updates })
function setup(state: UpdateState) {
  let listener = (_: UpdateState) => {}
  const unsubscribe = vi.fn()
  window.updates = { status: async () => state, onState: cb => { listener = cb; return unsubscribe }, check: vi.fn(async () => {}), download: vi.fn(async () => {}), install: vi.fn(async () => {}) }
  const view = render(<Provider><UpdateNotification onView={() => {}} /></Provider>)
  return { ...view, emit: (next: UpdateState) => act(() => listener(next)), unsubscribe }
}
it('dismisses a version for this session, but shows a newer version and unsubscribes on unmount', async () => {
  const view = setup({ status: 'available', currentVersion: '1.0.0', version: '1.1.0' })
  fireEvent.click(await screen.findByRole('button', { name: 'Dismiss' }))
  expect(screen.getByRole('complementary', { name: 'Application update' }).classList.contains('is-leaving')).toBe(true)
  expect((screen.getByRole('button', { name: 'Dismiss' }) as HTMLButtonElement).disabled).toBe(true)
  await waitFor(() => expect(screen.queryByRole('button', { name: 'View update' })).toBeNull())
  view.emit({ status: 'available', currentVersion: '1.0.0', version: '1.1.0' })
  expect(screen.queryByRole('button', { name: 'View update' })).toBeNull()
  view.emit({ status: 'available', currentVersion: '1.0.0', version: '1.2.0' })
  expect(screen.getByRole('status').textContent).toContain('1.2.0')
  view.unmount()
  expect(view.unsubscribe).toHaveBeenCalledOnce()
})
it.each(['unsupported', 'current', 'error', 'downloading', 'installing'] as const)('does not notify or start another check for %s', async status => {
  setup({ status, currentVersion: '1.0.0', version: '1.1.0' })
  await act(async () => {})
  expect(screen.queryByRole('button', { name: 'View update' })).toBeNull()
  expect(window.updates.check).not.toHaveBeenCalled()
})
it('does not let a late startup snapshot overwrite a newer updater event', async () => {
  let resolve!: (state: UpdateState) => void
  const view = setup({ status: 'idle', currentVersion: '1.0.0' })
  view.unmount()
  window.updates.status = () => new Promise(done => { resolve = done })
  render(<Provider><UpdateNotification onView={() => {}} /></Provider>)
  view.emit({ status: 'downloaded', currentVersion: '1.0.0', version: '1.1.0' })
  await act(async () => resolve({ status: 'idle', currentVersion: '1.0.0' }))
  expect(screen.getByRole('status').textContent).toContain('Update ready to install')
  expect(window.updates.check).not.toHaveBeenCalled()
})
it('silently handles a failed startup check without downloading or installing', async () => {
  setup({ status: 'idle', currentVersion: '1.0.0' })
  vi.mocked(window.updates.check).mockRejectedValue(new Error('Offline'))
  await waitFor(() => expect(window.updates.check).toHaveBeenCalledOnce())
  expect(screen.queryByRole('button', { name: 'View update' })).toBeNull()
  expect(window.updates.download).not.toHaveBeenCalled()
  expect(window.updates.install).not.toHaveBeenCalled()
})
