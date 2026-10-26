// @vitest-environment jsdom
import React from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Provider } from '../src/renderer/src/Provider'
import { RouterDashboard } from '../src/renderer/src/RouterDashboard'
beforeEach(() => vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} }))
afterEach(() => { cleanup(); vi.unstubAllGlobals() })
it('shows skeletons instead of offline or empty data before the first response', () => {
  window.plugins = { status: () => new Promise(() => {}), routerState: () => new Promise(() => {}), routerAuthStatus: () => new Promise(() => {}) } as any
  render(<Provider><RouterDashboard /></Provider>)
  expect(screen.getByRole('status', { name: 'Loading service status' })).toBeTruthy()
  expect(screen.getByRole('status', { name: 'Loading API keys' })).toBeTruthy()
  expect(screen.getByRole('status', { name: 'Loading dashboard session' })).toBeTruthy()
  expect(screen.queryByText('Service is offline')).toBeNull()
})
it('defaults to Overview and separates native 9router sections without claiming a running service', async () => {
  window.plugins = { health: async () => true, status: async () => ({ installed: true, installedVersion: '0.5.109' }) } as any
  render(<Provider><RouterDashboard /></Provider>)
  expect(screen.getByRole('tab', { name: 'Overview' }).getAttribute('aria-selected')).toBe('true')
  expect(screen.queryByText('Installation', { exact: true })).toBeNull()
  expect(screen.queryByText('Installed version')).toBeNull()
  expect(screen.queryByText('Service status')).toBeNull()
  await screen.findByLabelText('9router online')
  expect(screen.getByText(/Stop 9router from its tray or terminal/)).toBeTruthy()
  for (const name of ['Providers', 'Models', 'Logs']) {
    fireEvent.click(screen.getByRole('tab', { name }))
    await waitFor(() => expect(screen.getByRole('tab', { name }).getAttribute('aria-selected')).toBe('true'))
    expect(screen.getByRole('tabpanel', { name }).textContent).toContain(name === 'Logs' ? 'Service logs' : name)
  }
  fireEvent.click(screen.getByRole('tab', { name: 'Overview' }))
  await waitFor(() => expect((screen.getByRole('button', { name: 'Stop' }) as HTMLButtonElement).disabled).toBe(true))
})
it('starts a managed service and displays real API keys masked until revealed', async () => {
  let managed = false
  window.plugins = {
    status: async () => ({ installed: true }),
    routerState: async () => ({ online: managed, managed, busy: false, logs: 'server output' }),
    routerControl: async () => { managed = true; return { online: true, managed: true, busy: false, logs: 'server ready' } },
    routerKeys: async () => [{ id: '1', name: 'Coding', key: 'actual-secret-key' }]
  } as any
  render(<Provider><RouterDashboard /></Provider>)
  await waitFor(() => expect((screen.getByRole('button', { name: 'Start' }) as HTMLButtonElement).disabled).toBe(false))
  fireEvent.click(screen.getByRole('button', { name: 'Start' }))
  await screen.findByText('Coding')
  expect(screen.queryByText('actual-secret-key')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Show Coding key' }))
  expect(screen.getByText('actual-secret-key')).toBeTruthy()
  expect((screen.getByRole('button', { name: 'Stop' }) as HTMLButtonElement).disabled).toBe(false)
})
it('omits installation management and reports status failures', async () => {
  window.plugins = { status: async () => { throw new Error('Bridge unavailable') } } as any
  render(<Provider><RouterDashboard /></Provider>)
  await screen.findByRole('alert')
  await screen.findByLabelText('9router offline')
  expect(screen.queryByRole('button', { name: 'Manage installation in Library' })).toBeNull()
  expect(screen.queryByText(/Installed does not mean running/)).toBeNull()
})
