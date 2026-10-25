// @vitest-environment jsdom
import React from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { Session, WorkspaceAPI } from '../src/shared/types'
vi.mock('../src/renderer/src/TerminalPane', () => ({ TerminalPane: ({ session, visible }: { session: Session; visible: boolean }) => <div data-testid={session.id} data-visible={visible}>{session.error}</div> }))
import App from '../src/renderer/src/App'
afterEach(cleanup)
function setup(error = false) {
  const first: Session = { id: 'one', name: 'Pi 1', cwd: '/home/test', status: error ? 'error' : 'running', generation: 1, error: error ? 'Pi executable not found' : undefined }
  let sessions = [first]
  const api: WorkspaceAPI = {
    list: vi.fn(async () => sessions), create: vi.fn(async () => { const s = { ...first, id: `session-${sessions.length + 1}`, name: `Pi ${sessions.length + 1}` }; sessions = [...sessions, s]; return s }),
    folder: async () => '/home/test', chooseFolder: async () => '/project',
    onEvent: () => () => {}, snapshot: vi.fn(), input: vi.fn(), resize: vi.fn(), stop: vi.fn(), restart: vi.fn()
  }
  window.workspace = api
  render(<App />)
  return api
}
it('shows existing startup session without creating a duplicate', async () => {
  const api = setup(); await screen.findByRole('button', { name: /Pi 1/ })
  expect(api.create).not.toHaveBeenCalled(); expect(screen.getByTestId('one').getAttribute('data-visible')).toBe('true')
})
it('adds and selects a session; split shows both without unmounting the first', async () => {
  const api = setup(); await screen.findByRole('button', { name: /Pi 1/ })
  fireEvent.click(screen.getByRole('button', { name: /New session/ }))
  await screen.findByRole('button', { name: /Pi 2/ })
  expect(screen.getByTestId('one').getAttribute('data-visible')).toBe('false')
  expect(screen.getByTestId('session-2').getAttribute('data-visible')).toBe('true')
  fireEvent.click(screen.getByRole('button', { name: /Split view/ }))
  expect(screen.getByTestId('one').getAttribute('data-visible')).toBe('true')
  expect(api.stop).not.toHaveBeenCalled()
})
it('presents a failed startup session and allows selecting the new-session directory', async () => {
  setup(true); await screen.findByText('Pi executable not found')
  fireEvent.click(screen.getByRole('button', { name: /Choose folder/ }))
  await waitFor(() => expect(screen.getByTitle('/project')).toBeTruthy())
})
