// @vitest-environment jsdom
import React from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Provider } from '../src/renderer/src/Provider'
import { WorkspaceSetup } from '../src/renderer/src/WorkspaceSetup'
afterEach(cleanup)
it('checks only on Workspace and opens the selected missing plugin', async () => {
  const pi = vi.fn(async () => ({ installed: false }))
  window.piPlugin = { status: pi } as any
  window.plugins = { status: async () => ({ installed: false }) } as any
  const open = vi.fn()
  const view = render(<Provider><WorkspaceSetup active={false} onSetup={open} /></Provider>)
  expect(pi).not.toHaveBeenCalled()
  view.rerender(<Provider><WorkspaceSetup active onSetup={open} /></Provider>)
  fireEvent.click(await screen.findByRole('button', { name: 'Set up Pi' }))
  expect(open).toHaveBeenCalledWith('pi')
})
it('does not suggest installed or unverified plugins and does not repeat after Later', async () => {
  window.piPlugin = { status: async () => ({ installed: false, error: 'Cannot verify local installation' }) } as any
  window.plugins = { status: async () => ({ installed: false }) } as any
  const view = render(<Provider><WorkspaceSetup active onSetup={() => {}} /></Provider>)
  await screen.findByRole('button', { name: 'Set up 9router' })
  expect(screen.queryByRole('button', { name: 'Set up Pi' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Later' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  view.rerender(<Provider><WorkspaceSetup active={false} onSetup={() => {}} /></Provider>)
  view.rerender(<Provider><WorkspaceSetup active onSetup={() => {}} /></Provider>)
  expect(screen.queryByRole('dialog')).toBeNull()
})
