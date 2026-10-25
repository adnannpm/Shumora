// @vitest-environment jsdom
import React from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, render, fireEvent, screen, waitFor } from '@testing-library/react'
import type { Session } from '../src/shared/types'
const mounts = vi.hoisted(() => ({ count: 0 }))
vi.mock('../src/renderer/src/TerminalPane', () => ({ TerminalPane: ({ session, visible }: { session: Session; visible: boolean }) => {
  React.useEffect(() => { mounts.count++ }, [])
  return <div data-testid={session.id} data-visible={visible}>{session.name} pane</div>
} }))
import App from '../src/renderer/src/App'
import { Provider } from '../src/renderer/src/Provider'
afterEach(cleanup)
it('preserves terminal mounts when splitting, moving tabs and merging groups', async () => {
  const list: Session[] = [1, 2, 3].map(n => ({ id: String(n), name: `Pi ${n}`, cwd: '/tmp', status: 'running', generation: 1 }))
  window.workspace = { list: async () => list, folder: async () => '/tmp', onEvent: () => () => {} } as any
  render(<Provider><App /></Provider>)
  await screen.findByRole('tab', { name: 'Pi 1' }); await waitFor(() => expect(mounts.count).toBe(3))
  fireEvent.click(screen.getByRole('tab', { name: 'Pi 2' }))
  fireEvent.click(screen.getByRole('button', { name: 'Split right' }))
  expect(screen.getByTestId('2').getAttribute('data-visible')).toBe('true')
  fireEvent.click(screen.getByRole('tab', { name: 'Pi 3' }))
  expect(screen.getByTestId('3').getAttribute('data-visible')).toBe('true')
  expect(screen.getByTestId('2').getAttribute('data-visible')).toBe('true')
  fireEvent.click(screen.getByRole('button', { name: 'Move active tab from group 1 to other group' }))
  fireEvent.click(screen.getByRole('button', { name: 'Merge groups' }))
  expect(mounts.count).toBe(3)
  expect(screen.getAllByRole('tab')).toHaveLength(3)
})
