// @vitest-environment jsdom
import React from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, render, waitFor } from '@testing-library/react'
import type { Session } from '../src/shared/types'
const terminals = vi.hoisted(() => [] as Array<{ input: (data: string) => void; options: Record<string, unknown> }>)
vi.mock('@xterm/xterm', () => ({ Terminal: class {
  options: Record<string, unknown>
  input = (_: string) => {}
  cols = 80; rows = 24
  constructor(options: Record<string, unknown>) { this.options = options; terminals.push(this) }
  loadAddon() {} open() {} write() {} focus() {} dispose() {}
  onData(callback: (data: string) => void) { this.input = callback; return { dispose() {} } }
} }))
vi.mock('@xterm/addon-fit', () => ({ FitAddon: class { fit() {} } }))
import { TerminalPane } from '../src/renderer/src/TerminalPane'
import { Provider } from '../src/renderer/src/Provider'
afterEach(() => { cleanup(); terminals.length = 0; vi.unstubAllGlobals() })
it('blocks input for stopped/failed sessions without recreating the terminal, and enables it after restart', async () => {
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
  const session: Session = { id: 'one', name: 'Pi 1', cwd: '/tmp', status: 'running', generation: 1 }
  const input = vi.fn(async () => {})
  window.workspace = { input, snapshot: async () => ({ session, output: '', seq: 0 }), onEvent: () => () => {} } as any
  const props = { visible: false, focused: false, onFocus() {} }
  const view = render(<Provider><TerminalPane {...props} session={session} /></Provider>)
  await waitFor(() => expect(terminals).toHaveLength(1))
  terminals[0].input('hello'); expect(input).toHaveBeenCalledTimes(1)
  for (const status of ['exited', 'error'] as const) {
    view.rerender(<Provider><TerminalPane {...props} session={{ ...session, status }} /></Provider>)
    terminals[0].input('ignored')
    expect(input).toHaveBeenCalledTimes(1)
    expect(terminals[0].options.disableStdin).toBe(true)
    expect(terminals).toHaveLength(1)
  }
  view.rerender(<Provider><TerminalPane {...props} session={{ ...session, generation: 2 }} /></Provider>)
  expect(terminals).toHaveLength(2)
  terminals[1].input('again'); expect(input).toHaveBeenCalledTimes(2)
  expect(terminals[1].options.disableStdin).toBe(false)
})
