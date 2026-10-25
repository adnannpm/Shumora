// @vitest-environment jsdom
import React from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { Session, WorkspaceAPI } from '../src/shared/types'
vi.mock('../src/renderer/src/TerminalPane', () => ({ TerminalPane: ({ session, visible, onFocus }: { session: Session; visible: boolean; onFocus: () => void }) => <div data-testid={session.id} data-visible={visible} onClick={onFocus}>{session.error}</div> }))
import App from '../src/renderer/src/App'
import { Provider } from '../src/renderer/src/Provider'
afterEach(cleanup)
function setup(count = 1, approved = true) {
  let sessions: Session[] = Array.from({ length: count }, (_, i) => ({ id: String(i + 1), name: `Pi ${i + 1}`, cwd: '/tmp', status: 'running', generation: 1 }))
  let counter = count
  const api: WorkspaceAPI = {
    list: vi.fn(async () => sessions), create: vi.fn(async () => { const n = ++counter; const s: Session = { id: String(n), name: `Pi ${n}`, cwd: '/tmp', status: 'running', generation: 1 }; sessions = [...sessions, s]; return s }),
    close: vi.fn(async () => approved), folder: async () => '/tmp', chooseFolder: async () => '/project', onEvent: () => () => {}, snapshot: vi.fn(), input: vi.fn(), resize: vi.fn(), stop: vi.fn(), restart: vi.fn()
  }
  window.workspace = api; render(<Provider><App /></Provider>); return api
}
it('shows startup as a tab with workspace navigation and creates in the active group', async () => {
  const api = setup(); await screen.findByRole('tab', { name: 'Pi 1' })
  expect(screen.getByRole('complementary', { name: 'Main sidebar' })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'AI Workspace' }).getAttribute('aria-current')).toBe('page')
  expect(api.create).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'New session in group 1' }))
  await screen.findByRole('tab', { name: 'Pi 2' })
  expect(screen.getByTestId('1').getAttribute('data-visible')).toBe('false')
  expect(screen.getByTestId('2').getAttribute('data-visible')).toBe('true')
})
it('opens settings and collapses navigation without stopping or recreating sessions', async () => {
  const api = setup(); await screen.findByRole('tab', { name: 'Pi 1' })
  fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
  expect(screen.getByRole('heading', { name: 'Settings' })).toBeTruthy()
  expect(screen.queryByRole('tab', { name: 'Pi 1' })).toBeNull()
  expect(screen.getByTestId('1')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Collapse sidebar' }))
  expect(screen.getByRole('button', { name: 'Expand sidebar' }).getAttribute('aria-expanded')).toBe('false')
  fireEvent.click(screen.getByRole('button', { name: 'AI Workspace' }))
  expect(screen.getByRole('tab', { name: 'Pi 1' })).toBeTruthy()
  expect(api.create).not.toHaveBeenCalled(); expect(api.stop).not.toHaveBeenCalled()
})
it('honors close cancellation and leaves an empty state after closing the last tab', async () => {
  const api = setup(); await screen.findByRole('tab', { name: 'Pi 1' })
  fireEvent.click(screen.getByRole('button', { name: 'Close Pi 1' }))
  await screen.findByRole('alertdialog', { name: 'Close Pi 1?' })
  expect(api.close).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
  await screen.findByRole('tab', { name: 'Pi 1' })
  fireEvent.click(screen.getByRole('button', { name: 'Close Pi 1' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Stop and close' }))
  await screen.findByText('No open sessions')
  expect(api.create).not.toHaveBeenCalled()
})
it('moves the active tab into a split, supports both orientations and keyboard resizing', async () => {
  const api = setup(3); await screen.findByRole('tab', { name: 'Pi 1' })
  fireEvent.click(screen.getByRole('tab', { name: 'Pi 2' }))
  fireEvent.click(screen.getByRole('button', { name: 'Split right' }))
  expect(screen.getAllByRole('tablist')).toHaveLength(2)
  expect(screen.getByTestId('2').getAttribute('data-visible')).toBe('true')
  expect(api.create).not.toHaveBeenCalled(); expect(api.stop).not.toHaveBeenCalled()
  const divider = screen.getByRole('separator')
  fireEvent.keyDown(divider, { key: 'ArrowRight' }); expect(divider.getAttribute('aria-valuenow')).toBe('55')
  fireEvent.click(screen.getByRole('button', { name: 'Split down' }))
  expect(screen.getByRole('separator').getAttribute('aria-orientation')).toBe('horizontal')
  fireEvent.click(screen.getByRole('button', { name: 'Merge groups' }))
  expect(screen.getAllByRole('tablist')).toHaveLength(1)
})
it('collapses a group after its last tab closes without closing the remaining process', async () => {
  const api = setup(2); await screen.findByRole('tab', { name: 'Pi 1' })
  fireEvent.click(screen.getByRole('button', { name: 'Split right' }))
  fireEvent.click(screen.getByRole('button', { name: 'Close Pi 1' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Stop and close' }))
  await waitFor(() => expect(screen.getAllByRole('tablist')).toHaveLength(1))
  expect(screen.getByRole('tab', { name: 'Pi 2' })).toBeTruthy()
  expect(api.close).toHaveBeenCalledWith('1'); expect(api.stop).not.toHaveBeenCalled()
})
it('explicitly creates a split partner when only one tab exists', async () => {
  const api = setup(); await screen.findByRole('tab', { name: 'Pi 1' })
  fireEvent.click(screen.getByRole('button', { name: 'New session in split right' }))
  await screen.findByRole('tab', { name: 'Pi 2' })
  expect(api.create).toHaveBeenCalledTimes(1)
  expect(screen.getAllByRole('tablist')).toHaveLength(2)
  fireEvent.click(screen.getByRole('button', { name: 'Choose folder for new sessions' }))
  await waitFor(() => expect(screen.getByTitle('/project')).toBeTruthy())
})
