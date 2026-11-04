// @vitest-environment jsdom
import { expect, it, vi } from 'vitest'
import { terminalClipboardHandler } from '../src/renderer/src/terminal-clipboard'

function setup(selection = '') {
  const term = { getSelection: () => selection, paste: vi.fn() }
  const options = { copy: vi.fn(async (_text: string) => {}), read: vi.fn(async () => 'hello\nworld'), canPaste: vi.fn(() => true), report: vi.fn() }
  return { term, options, handle: terminalClipboardHandler(term, options) }
}
const key = (value: string, options: KeyboardEventInit = {}, type = 'keydown') => new KeyboardEvent(type, { key: value, ctrlKey: true, cancelable: true, ...options })

it.each([{ ctrlKey: true }, { ctrlKey: true, shiftKey: true }, { ctrlKey: false, metaKey: true }])('copies the terminal selection with %j', async modifiers => {
  const { handle, options } = setup('selected output')
  const event = key('c', modifiers)
  expect(handle(event)).toBe(false)
  expect(event.defaultPrevented).toBe(true)
  await Promise.resolve()
  expect(options.copy).toHaveBeenCalledWith('selected output')
  handle(key('c', modifiers, 'keyup'))
  expect(options.copy).toHaveBeenCalledTimes(1)
})
it('keeps Ctrl+C without a selection available for interrupt', () => {
  const { handle, options } = setup()
  expect(handle(key('c'))).toBe(true)
  expect(options.copy).not.toHaveBeenCalled()
})
it.each([{ ctrlKey: true }, { ctrlKey: true, shiftKey: true }, { ctrlKey: false, metaKey: true }])('pastes once via xterm with %j', async modifiers => {
  const { handle, options, term } = setup()
  expect(handle(key('v', modifiers))).toBe(false)
  handle(key('v', modifiers, 'keyup'))
  await Promise.resolve()
  expect(options.read).toHaveBeenCalledTimes(1)
  expect(term.paste).toHaveBeenCalledExactlyOnceWith('hello\nworld')
})
it('does not paste into stopped or disposed sessions, including an in-flight read', async () => {
  const { handle, options, term } = setup()
  options.canPaste.mockReturnValue(false)
  handle(key('v'))
  expect(options.read).not.toHaveBeenCalled()
  options.canPaste.mockReturnValue(true)
  handle(key('v'))
  options.canPaste.mockReturnValue(false)
  await Promise.resolve()
  expect(term.paste).not.toHaveBeenCalled()
})
it('reports clipboard failures without sending input', async () => {
  const { handle, options, term } = setup()
  options.read.mockRejectedValue(new Error('clipboard unavailable'))
  handle(key('v'))
  await vi.waitFor(() => expect(options.report).toHaveBeenCalled())
  expect(term.paste).not.toHaveBeenCalled()
})
it('leaves AltGr and unrelated shortcuts alone', () => {
  const { handle } = setup('selection')
  expect(handle(key('v', { altKey: true }))).toBe(true)
  expect(handle(key('a'))).toBe(true)
})
