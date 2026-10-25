// @vitest-environment jsdom
import React from 'react'
import { expect, it, vi } from 'vitest'
import { render, fireEvent, screen } from '@testing-library/react'
import type { Session } from '../src/shared/types'
vi.mock('../src/renderer/src/TerminalPane', () => ({ TerminalPane: ({ session, visible, onFocus }: { session: Session; visible: boolean; onFocus: () => void }) => <button data-testid={session.id} data-visible={visible} onClick={onFocus}>{session.name} pane</button> }))
import App from '../src/renderer/src/App'
import { Provider } from '../src/renderer/src/Provider'
it('can display any two sessions and keeps both panes stable when focusing either', async () => {
  const list: Session[] = [1, 2, 3].map((n) => ({ id: String(n), name: `Pi ${n}`, cwd: '/tmp', status: 'running', generation: 1 }))
  window.workspace = { list: async () => list, folder: async () => '/tmp', onEvent: () => () => {} } as any
  render(<Provider><App /></Provider>)
  await screen.findByRole('button', { name: /Pi 1.*Process/ })
  fireEvent.click(screen.getByRole('button', { name: /Pi 2.*Process/ }))
  fireEvent.click(screen.getByRole('button', { name: /Split view/ }))
  fireEvent.click(screen.getByRole('button', { name: /Pi 3.*Process/ }))
  expect(screen.getByTestId('2').getAttribute('data-visible')).toBe('true')
  expect(screen.getByTestId('3').getAttribute('data-visible')).toBe('true')
  expect(screen.getByTestId('1').getAttribute('data-visible')).toBe('false')
  fireEvent.click(screen.getByTestId('2'))
  expect(screen.getByTestId('3').getAttribute('data-visible')).toBe('true')
})
