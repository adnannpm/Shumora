// @vitest-environment jsdom
import React from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, render, fireEvent, screen, waitFor } from '@testing-library/react'
import type { Session } from '../src/shared/types'
const mounts = vi.hoisted(() => ({ count: 0 }))
vi.mock('../src/renderer/src/TerminalPane', () => ({ TerminalPane: ({ session, visible }: { session: Session; visible: boolean }) => {
  React.useEffect(() => { mounts.count++ }, [])
  return <div data-testid={session.id} data-visible={visible}>{session.name} pane</div>
} }))
import App from '../src/renderer/src/App'
import { Provider } from '../src/renderer/src/Provider'
beforeEach(() => {
  window.piPlugin = { status: async () => ({ installed: true }) } as any
  window.plugins = { status: async () => ({ installed: true }) } as any
})
afterEach(cleanup)
it('preserves terminal mounts when splitting, moving tabs and merging groups', async () => {
  const list: Session[] = [1, 2, 3].map(n => ({ id: String(n), name: `Pi ${n}`, cwd: '/tmp', status: 'running', generation: 1 }))
  window.workspace = { list: async () => list, folder: async () => '/tmp', onEvent: () => () => {} } as any
  render(<Provider><App /></Provider>)
  await screen.findByRole('tab', { name: 'Pi 1' }); await waitFor(() => expect(mounts.count).toBe(3))
  fireEvent.click(screen.getByRole('tab', { name: 'Pi 2' }))
  const splitRight = screen.getByRole('button', { name: 'Split right' })
  const splitDown = screen.getByRole('button', { name: 'Split down' })
  expect(splitRight.textContent).toBe('')
  expect(splitDown.textContent).toBe('')
  expect(splitRight.getAttribute('title')).toBe('Split right')
  expect(splitDown.getAttribute('title')).toBe('Split down')
  expect(splitRight.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
  expect(screen.getByRole('group', { name: 'Terminal layout' }).contains(splitRight)).toBe(true)
  fireEvent.click(splitRight)
  const merge = screen.getByRole('button', { name: 'Merge groups' })
  expect(merge.textContent).toBe('')
  expect(merge.getAttribute('title')).toBe('Merge groups')
  expect(screen.getByTestId('2').getAttribute('data-visible')).toBe('true')
  fireEvent.click(screen.getByRole('tab', { name: 'Pi 3' }))
  expect(screen.getByTestId('3').getAttribute('data-visible')).toBe('true')
  expect(screen.getByTestId('2').getAttribute('data-visible')).toBe('true')
  fireEvent.click(screen.getByRole('button', { name: 'Move active tab from group 1 to other group' }))
  fireEvent.click(screen.getByRole('button', { name: 'Merge groups' }))
  expect(mounts.count).toBe(3)
  expect(screen.getAllByRole('tab')).toHaveLength(3)
})

it('shows one workspace git button that follows the focused group in split view', async () => {
  const list: Session[] = [1, 2].map(n => ({ id: String(n), name: `Pi ${n}`, cwd: `/repo${n}`, status: 'running', generation: 1 }))
  const gitStatus = vi.fn(async (id: string) => ({ isRepo: true, branch: id === '1' ? 'main' : 'feature', changes: [] }))
  window.workspace = { list: async () => list, folder: async () => '/tmp', onEvent: () => () => {}, gitStatus } as any
  render(<Provider><App /></Provider>)
  await screen.findByRole('tab', { name: 'Pi 1' })
  fireEvent.click(screen.getByRole('tab', { name: 'Pi 2' }))
  fireEvent.click(screen.getByRole('button', { name: 'Split right' }))
  expect(await screen.findAllByTitle(/Working tree clean/)).toHaveLength(1)
  expect(screen.getByTitle('Working tree clean (Pi 2)')).toBeTruthy()
  expect(screen.getByTitle('Switch branch (Pi 2)').textContent).toContain('feature')
  fireEvent.pointerDown(screen.getByRole('tab', { name: 'Pi 1' }).closest('.tab-group-bar')!)
  expect(await screen.findByTitle('Working tree clean (Pi 1)')).toBeTruthy()
  expect(screen.getAllByTitle(/Working tree clean/)).toHaveLength(1)
})
