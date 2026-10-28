// @vitest-environment jsdom
import React from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { Provider } from '../src/renderer/src/Provider'
import { PackageDetails } from '../src/renderer/src/PackageDetails'
import type { PiPackage, PackageInstallation } from '../src/shared/packages'
afterEach(cleanup)
const item: PiPackage = { name: 'demo-tools', description: 'Tools', author: 'Demo', types: ['extension'], downloads: 10, version: '1.2.3' }
function setup() {
  const mutate = vi.fn(async () => ({ status: 'success', output: 'installed' }))
  window.packages = { status: vi.fn(async () => ({ configured: false, installed: false })), mutate, onOperation: () => () => {} } as any
  return mutate
}
it('uses a standalone toolbar and action footer, retains preview, and confirms before installing', async () => {
  const mutate = setup()
  render(<Provider><PackageDetails item={item} onBack={() => {}} /></Provider>)
  const toolbar = screen.getByRole('banner')
  expect(within(toolbar).getByRole('button', { name: 'Back to packages' })).toBeTruthy()
  expect(within(toolbar).getByRole('heading', { name: item.name })).toBeTruthy()
  expect(within(toolbar).getByRole('button', { name: 'Refresh installation status' })).toBeTruthy()
  expect(screen.getByText('DE')).toBeTruthy()
  expect(screen.queryByRole('log')).toBeNull()
  expect(screen.getByRole('link', { name: 'npm' }).getAttribute('rel')).toContain('noopener')
  const footer = screen.getByRole('contentinfo', { name: 'Package actions' })
  fireEvent.click(await within(footer).findByRole('button', { name: 'Install for Pi' }))
  expect(mutate).not.toHaveBeenCalled()
  fireEvent.click(await screen.findByRole('button', { name: 'Confirm install' }))
  await waitFor(() => expect(mutate).toHaveBeenCalledWith('install', item.name, item.version))
  await waitFor(() => expect(screen.getByRole('log').textContent).toContain('installed'))
  expect(screen.getByRole('button', { name: 'Copy log' })).toBeTruthy()
})
it('warns before updating and cancelling does not change packages', async () => {
  const mutate = setup()
  window.packages.status = vi.fn(async () => ({ configured: true, installed: true, installedVersion: '1.0.0' }))
  render(<Provider><PackageDetails item={item} onBack={() => {}} /></Provider>)
  fireEvent.click(await screen.findByRole('button', { name: 'Update' }))
  const modal = await screen.findByRole('alertdialog')
  expect(modal.textContent).toContain('All running Workspace sessions will be stopped')
  expect(modal.textContent).toContain('Agent work and previous conversations will not resume automatically')
  fireEvent.click(within(modal).getByRole('button', { name: 'Cancel' }))
  expect(mutate).not.toHaveBeenCalled()
  fireEvent.click(await screen.findByRole('button', { name: 'Update' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Stop sessions and update' }))
  await waitFor(() => expect(mutate).toHaveBeenCalledWith('update', item.name, item.version))
})
it('keeps package failures visible after installation status refresh', async () => {
  setup()
  window.packages.mutate = vi.fn(async () => { throw new Error('offline') })
  render(<Provider><PackageDetails item={item} onBack={() => {}} /></Provider>)
  fireEvent.click(await screen.findByRole('button', { name: 'Install for Pi' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Confirm install' }))
  await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Package operation failed'))
  await waitFor(() => expect(window.packages.status).toHaveBeenCalledTimes(2))
  expect(screen.getByRole('alert').textContent).toContain('Sessions stopped for this operation remain stopped')
})
it('retains the preview slot when detail media fails', async () => {
  setup()
  render(<Provider><PackageDetails item={{ ...item, thumbnail: 'https://images.example.com/demo.png' }} onBack={() => {}} /></Provider>)
  fireEvent.error(screen.getByRole('img', { name: `${item.name} preview` }))
  expect(screen.queryByRole('img')).toBeNull()
  expect(screen.getByText('DE').parentElement?.className).toContain('package-preview-detail')
})
it('ignores stale installation responses when changing package identity', async () => {
  setup()
  let resolveOld!: (value: PackageInstallation) => void
  window.packages.status = vi.fn((name: string) => name === item.name ? new Promise<PackageInstallation>(resolve => { resolveOld = resolve }) : Promise.resolve({ configured: false, installed: false }))
  const view = render(<Provider><PackageDetails item={item} onBack={() => {}} /></Provider>)
  view.rerender(<Provider><PackageDetails item={{ ...item, name: 'other-package' }} onBack={() => {}} /></Provider>)
  await screen.findByRole('button', { name: 'Install for Pi' })
  resolveOld({ configured: true, installed: true, installedVersion: '0.0.1' })
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Uninstall' })).toBeNull())
  expect(screen.getByRole('button', { name: 'Install for Pi' })).toBeTruthy()
})
