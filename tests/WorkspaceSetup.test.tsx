// @vitest-environment jsdom
import React from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Provider } from '../src/renderer/src/Provider'
import { WorkspaceSetup } from '../src/renderer/src/WorkspaceSetup'
afterEach(cleanup)
function tools(installed = true) {
  window.opencodePlugin = { status: async () => ({ installed: true, installedVersion: '1.18.34' }) } as any
  window.nodePlugin = { status: async () => ({ installed: true, installedVersion: '22.0.0' }) } as any
  window.piPlugin = { status: async () => ({ installed, availableManagers: ['npm', 'bun'], latestVersion: '1.0.0' }), onOperation: () => () => {}, mutate: vi.fn(async () => ({ installed: true })) } as any
  window.plugins = { status: async () => ({ installed: false, availableManagers: ['npm', 'bun'], latestVersion: '2.0.0' }), onOperation: () => () => {} } as any
}
it('guides package manager, Pi, optional 9router and completion without folder or review steps', async () => {
  tools()
  const done = vi.fn(async () => {})
  render(<Provider><WorkspaceSetup active onSetup={() => {}} onContinue={done} /></Provider>)
  const next = screen.getByRole('button', { name: 'Next' })
  await waitFor(() => expect(next.hasAttribute('disabled')).toBe(false))
  expect(screen.queryByRole('button', { name: 'Choose folder' })).toBeNull()
  fireEvent.click(screen.getByRole('radio', { name: /Bun/ }))
  fireEvent.click(next)
  expect(screen.getByRole('heading', { name: 'Choose your harness' })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Next' }))
  expect(screen.getByRole('heading', { name: 'Add 9router' })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Skip for now' }))
  expect(screen.getByRole('heading', { name: 'Ready to code' })).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Back' })).toBeNull()
  expect(screen.getByRole('list', { name: 'Terminal setup steps' })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Step 4: Done' }).closest('li')?.getAttribute('aria-current')).toBe('step')
  expect(screen.getByRole('heading', { name: 'What comes next?' })).toBeTruthy()
  expect(screen.getByText('You can add 9router later from Plugins. It does not block your first session.')).toBeTruthy()
  expect(done).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Go to Terminals' }))
  await waitFor(() => expect(done).toHaveBeenCalledOnce())
})
it('routes missing tools to existing plugin details without installing inside setup', async () => {
  tools(false)
  const open = vi.fn()
  const view = render(<Provider><WorkspaceSetup active onSetup={open} /></Provider>)
  await waitFor(() => expect(screen.getByRole('button', { name: 'Next' }).hasAttribute('disabled')).toBe(false))
  fireEvent.click(screen.getByRole('button', { name: 'Set up pnpm' }))
  expect(open).toHaveBeenLastCalledWith('pnpm')
  fireEvent.click(screen.getByRole('button', { name: 'Next' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Set up Pi' }))
  expect(open).toHaveBeenLastCalledWith('pi')
  expect(window.piPlugin.mutate).not.toHaveBeenCalled()
  expect(screen.queryByRole('button', { name: 'Confirm install' })).toBeNull()
  view.rerender(<Provider><WorkspaceSetup active={false} onSetup={open} /></Provider>)
  window.piPlugin.status = async () => ({ installed: true, availableManagers: ['npm', 'bun'] }) as any
  view.rerender(<Provider><WorkspaceSetup active onSetup={open} /></Provider>)
  await waitFor(() => expect(screen.getByRole('button', { name: 'Next' }).hasAttribute('disabled')).toBe(false))
  fireEvent.click(screen.getByRole('button', { name: 'Next' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Open 9router plugin' }))
  expect(open).toHaveBeenLastCalledWith('9router')
})
it('allows installed OpenCode instead of missing Pi and summarizes the selected harness', async () => {
  tools(false)
  const done = vi.fn(async () => {})
  const open = vi.fn()
  render(<Provider><WorkspaceSetup active onSetup={open} onContinue={done} /></Provider>)
  const next = screen.getByRole('button', { name: 'Next' })
  await waitFor(() => expect(next.hasAttribute('disabled')).toBe(false))
  fireEvent.click(next)
  expect(next.hasAttribute('disabled')).toBe(true)
  fireEvent.click(screen.getByRole('radio', { name: /OpenCode/ }))
  expect(next.hasAttribute('disabled')).toBe(false)
  fireEvent.click(screen.getByRole('button', { name: 'Details OpenCode' }))
  expect(open).toHaveBeenCalledWith('opencode')
  fireEvent.click(next)
  fireEvent.click(screen.getByRole('button', { name: 'Skip for now' }))
  expect(screen.getByText('OpenCode')).toBeTruthy()
  expect(screen.getByText('Installed · 1.18.34')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Go to Terminals' }))
  await waitFor(() => expect(done).toHaveBeenCalledOnce())
})
it('does not open startup setup for missing optional router when Pi is installed', async () => {
  tools()
  render(<Provider><WorkspaceSetup startupOnly active onSetup={() => {}} /></Provider>)
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
})
it('shows missing Pi setup and dismisses without installation', async () => {
  tools(false)
  render(<Provider><WorkspaceSetup startupOnly active onSetup={() => {}} /></Provider>)
  fireEvent.click(await screen.findByRole('button', { name: 'Later' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(window.piPlugin.mutate).not.toHaveBeenCalled()
})
