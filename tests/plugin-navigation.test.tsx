// @vitest-environment jsdom
import React from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { Provider } from '../src/renderer/src/Provider'
import { RouterDetails } from '../src/renderer/src/RouterPlugin'
import type { PluginOperation } from '../src/shared/plugins'

afterEach(cleanup)
it.each(['pi', '9router', 'opencode', 'bun'] as const)('restores %s installation on return and follows completion without reinstalling', async id => {
  let operation: PluginOperation = { status: 'running', output: 'downloading 10%\n' }
  let installed = false
  const listeners = new Set<(value: PluginOperation) => void>()
  const api = {
    status: vi.fn(async () => ({ id, name: id, installed, installedVersion: installed ? '1.4.0' : undefined, latestVersion: '1.4.0', busy: !installed, availableManagers: ['npm'] })),
    operation: vi.fn(async () => operation),
    onOperation: (callback: (value: PluginOperation) => void) => { listeners.add(callback); return () => { listeners.delete(callback) } },
    mutate: vi.fn()
  }
  if (id === 'pi') window.piPlugin = api as any
  if (id === '9router') window.plugins = api as any
  if (id === 'opencode') window.opencodePlugin = api as any
  if (id === 'bun') window.managerPlugins = { status: () => api.status(), operation: () => api.operation(), onOperation: (_id: string, callback: (value: PluginOperation) => void) => api.onOperation(callback), mutate: api.mutate } as any
  const page = <Provider><RouterDetails pi={id === 'pi'} opencode={id === 'opencode'} managerId={id === 'bun' ? 'bun' : undefined} /></Provider>
  const first = render(page)
  expect((await screen.findByRole('log')).textContent).toContain('downloading 10%')
  first.unmount()
  expect(listeners.size).toBe(0)
  operation = { status: 'running', output: 'downloading 75%\n' }
  render(page)
  expect((await screen.findByRole('log')).textContent).toContain('downloading 75%')
  expect((screen.getByRole('button', { name: 'Install' }) as HTMLButtonElement).disabled).toBe(true)
  act(() => {
    installed = true
    operation = { status: 'success', output: 'installation complete\n' }
    listeners.forEach(callback => callback(operation))
  })
  await screen.findByRole('button', { name: 'Uninstall' })
  expect(screen.getByRole('log').textContent).toContain('installation complete')
  expect(api.mutate).not.toHaveBeenCalled()
})
it('does not overwrite a live progress event with an older operation snapshot', async () => {
  let snapshot!: (value: PluginOperation) => void
  let receive!: (value: PluginOperation) => void
  window.piPlugin = {
    status: async () => ({ id: 'pi', installed: false, latestVersion: '1.4.0', availableManagers: ['npm'] }),
    operation: () => new Promise(resolve => { snapshot = resolve }),
    onOperation: (callback: (value: PluginOperation) => void) => { receive = callback; return () => {} }
  } as any
  render(<Provider><RouterDetails pi /></Provider>)
  await waitFor(() => expect(receive).toBeTypeOf('function'))
  await act(async () => {
    receive({ status: 'running', output: 'new output' })
    snapshot({ status: 'idle', output: '' })
  })
  expect((await screen.findByRole('log')).textContent).toBe('new output')
})
