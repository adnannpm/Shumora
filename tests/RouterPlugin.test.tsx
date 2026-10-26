// @vitest-environment jsdom
import React from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Provider } from '../src/renderer/src/Provider'
import { RouterCard, RouterDetails } from '../src/renderer/src/RouterPlugin'
import type { PluginOperation, RouterPlugin } from '../src/shared/plugins'
afterEach(cleanup)
const routerAPI = { routerLogin: async () => {}, routerLogout: async () => {}, routerAuthStatus: async () => ({ authenticated: false, required: true }), routerOpenOAuth: async () => {}, routerEditProvider: async () => {}, routerCustomProvider: async () => '', routerModelEnabled: async () => {}, routerProviders: async () => [], routerModels: async () => [], routerAddProvider: async () => {}, routerToggleProvider: async () => {}, routerRemoveProvider: async () => {}, routerTestProvider: async () => false, routerModelAlias: async () => {}, routerState: async () => ({ online: false, managed: false, busy: false, logs: '' }), routerControl: async () => ({ online: false, managed: false, busy: false, logs: '' }), routerKeys: async () => [], routerCreateKey: async () => ({ id: '', name: '', key: '' }) }
const plugin: RouterPlugin = { id: '9router', name: '9router', description: 'AI gateway', repository: 'https://github.com/decolua/9router', installed: false, latestVersion: '0.5.109', changelog: '## Fixes\n- Router fixes', checkedAt: '', busy: false }
it('shows live read-only output, closes confirmation, copies errors and cleans up', async () => {
  let receive!: (operation: PluginOperation) => void
  let finish!: (value: RouterPlugin) => void
  const unsubscribe = vi.fn()
  const copy = vi.fn().mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: copy } })
  window.plugins = {
    ...routerAPI,
    health: async () => false,
    status: async () => plugin,
    operation: async () => ({ status: 'idle', output: '' }),
    onOperation: callback => { receive = callback; return unsubscribe },
    mutate: () => new Promise(resolve => { finish = resolve })
  }
  const view = render(<Provider><RouterDetails /></Provider>)
  fireEvent.click(await screen.findByRole('button', { name: 'Install' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Confirm install' }))
  await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
  act(() => receive({ status: 'running', output: 'npm downloading package\n' }))
  expect(screen.getByRole('log').textContent).toContain('npm downloading package')
  expect(screen.queryByRole('textbox')).toBeNull()
  act(() => receive({ status: 'failed', output: 'npm ERR! EACCES permission denied\n' }))
  await act(async () => finish({ ...plugin, operationError: 'EACCES' }))
  expect(screen.getByRole('log').textContent).toContain('EACCES permission denied')
  expect(screen.getByRole('alert').textContent).not.toContain('EACCES')
  expect(screen.getByText('Failed', { exact: true })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Copy log' }))
  await waitFor(() => expect(copy).toHaveBeenCalledWith('npm ERR! EACCES permission denied\n'))
  view.unmount()
  expect(unsubscribe).toHaveBeenCalledOnce()
})
it('puts a saved operation error in the output panel, not the page alert', async () => {
  window.plugins = {
    ...routerAPI,
    health: async () => false,
    status: async () => ({ ...plugin, operationError: 'Error: Command failed: npm EACCES stack trace' }),
    operation: async () => ({ status: 'idle', output: '' }),
    onOperation: () => () => {}, mutate: vi.fn()
  }
  render(<Provider><RouterDetails /></Provider>)
  await waitFor(() => expect(screen.getByRole('log').textContent).toContain('npm EACCES stack trace'))
  expect(screen.getByRole('alert').textContent).not.toContain('stack trace')
})
it('opens detail from the plugin card', () => {
  const open = vi.fn(); window.plugins = { status: async () => plugin } as any
  render(<Provider><RouterCard onOpen={open} /></Provider>)
  fireEvent.click(screen.getByRole('button', { name: 'Open 9router plugin' })); expect(open).toHaveBeenCalledOnce()
})
it('requires confirmation and passes the displayed exact install version', async () => {
  window.plugins = { ...routerAPI, health: async () => false, status: async () => plugin, operation: async () => ({ status: 'idle', output: '' }), onOperation: () => () => {}, mutate: vi.fn(async () => ({ ...plugin, installed: true, installedVersion: plugin.latestVersion })) }
  render(<Provider><RouterDetails /></Provider>)
  fireEvent.click(await screen.findByRole('button', { name: 'Install' }))
  await screen.findByRole('alertdialog')
  expect(window.plugins.mutate).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Confirm install' }))
  await waitFor(() => expect(window.plugins.mutate).toHaveBeenCalledWith('install', '0.5.109'))
  await screen.findByRole('button', { name: 'Uninstall' })
  expect((screen.getByRole('button', { name: 'Update' }) as HTMLButtonElement).disabled).toBe(true)
})
