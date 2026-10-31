// @vitest-environment jsdom
import React from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import type { Session } from '../src/shared/types'
const terminals = vi.hoisted(() => [] as Array<{ input: (data: string) => void; options: Record<string, unknown>; addons: Array<{ dispose?: () => void }>; disposed: boolean }>)
const imageAddons = vi.hoisted(() => [] as Array<{ options: Record<string, unknown>; dispose: ReturnType<typeof vi.fn> }>)
vi.mock('@xterm/addon-image', () => ({ ImageAddon: class {
  dispose = vi.fn()
  constructor(public options: Record<string, unknown>) { imageAddons.push(this) }
} }))
vi.mock('@xterm/xterm', () => ({ Terminal: class {
  options: Record<string, unknown>
  input = (_: string) => {}
  cols = 80; rows = 24
  constructor(options: Record<string, unknown>) { this.options = options; terminals.push(this) }
  addons: Array<{ dispose?: () => void }> = []
  disposed = false
  loadAddon(addon: { dispose?: () => void }) { this.addons.push(addon) }
  open() {} write() {} focus() {}
  dispose() { this.disposed = true; this.addons.forEach(addon => addon.dispose?.()) }
  onData(callback: (data: string) => void) { this.input = callback; return { dispose() {} } }
} }))
vi.mock('@xterm/addon-fit', () => ({ FitAddon: class { fit() {} } }))
import { TerminalPane } from '../src/renderer/src/TerminalPane'
import { Provider } from '../src/renderer/src/Provider'
afterEach(() => { cleanup(); terminals.length = 0; imageAddons.length = 0; vi.unstubAllGlobals() })
it.each(['[pi-9router-ext] Press any key to continue', 'Continue? [y/n]', '\r\nPi ready'])('removes the text-free spinner on initial output: %s', async output => {
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
  const session: Session = { id: 'one', name: 'Pi 1', cwd: '/tmp', status: 'running', generation: 1 }
  let listener: (event: any) => void = () => {}
  window.workspace = { snapshot: async () => ({ session, output: '', seq: 0 }), onEvent: (callback: typeof listener) => { listener = callback; return () => {} } } as any
  render(<Provider><TerminalPane session={session} visible={true} focused={false} onFocus={() => {}} /></Provider>)
  expect(screen.getByRole('progressbar').textContent).toBe('')
  await act(async () => {})
  act(() => listener({ type: 'data', id: 'one', generation: 1, seq: 1, data: output }))
  expect(screen.queryByRole('progressbar')).toBeNull()
})
it('does not show loading over restored output or an exited session', async () => {
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
  const session: Session = { id: 'one', name: 'Pi 1', cwd: '/tmp', status: 'running', generation: 1 }
  window.workspace = { snapshot: async () => ({ session, output: 'Press any key to continue', seq: 1 }), onEvent: () => () => {} } as any
  const view = render(<Provider><TerminalPane session={session} visible={false} focused={false} onFocus={() => {}} /></Provider>)
  await waitFor(() => expect(screen.queryByRole('progressbar')).toBeNull())
  view.rerender(<Provider><TerminalPane session={{ ...session, status: 'exited' }} visible={false} focused={false} onFocus={() => {}} /></Provider>)
  expect(screen.queryByRole('progressbar')).toBeNull()
})
it('blocks input for stopped/failed sessions without recreating the terminal, and enables it after restart', async () => {
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
  const session: Session = { id: 'one', name: 'Pi 1', cwd: '/tmp', status: 'running', generation: 1 }
  const input = vi.fn(async () => {})
  window.workspace = { input, snapshot: async () => ({ session, output: '', seq: 0 }), onEvent: () => () => {} } as any
  const props = { visible: false, focused: false, onFocus() {} }
  const view = render(<Provider><TerminalPane {...props} session={session} /></Provider>)
  await waitFor(() => expect(terminals).toHaveLength(1))
  expect(imageAddons).toHaveLength(1)
  expect(imageAddons[0].options).toEqual({ storageLimit: 16, pixelLimit: 4_194_304 })
  expect(terminals[0].addons).toContain(imageAddons[0])
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
  expect(imageAddons).toHaveLength(2)
  expect(imageAddons[0].dispose).toHaveBeenCalledTimes(1)
  view.unmount()
  expect(imageAddons[1].dispose).toHaveBeenCalledTimes(1)
})
