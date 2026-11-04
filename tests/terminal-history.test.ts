import { expect, it } from 'vitest'
import { TerminalHistory } from '../src/main/terminal-history'

it('matches the existing UTF-16 tail semantics through repeated overflow', () => {
  const history = new TerminalHistory(20)
  let expected = ''
  for (const chunk of ['hello', '', '\u001b[31mred', '🙂'.repeat(30), ...Array.from({ length: 2000 }, (_, i) => String(i))]) {
    history.append(chunk)
    expected = (expected + chunk).slice(-20)
    expect(history.text()).toBe(expected)
  }
})

it('retains the exact tail with large history and tiny incoming chunks', () => {
  const history = new TerminalHistory(512_000)
  history.append('a'.repeat(512_000))
  for (let i = 0; i < 10_000; i++) history.append('b')
  expect(history.text()).toBe('a'.repeat(502_000) + 'b'.repeat(10_000))
  expect(history.text()).toBe(history.text())
})

it('keeps tiny-write metadata bounded by packing adjacent chunks', () => {
  const history = new TerminalHistory(512_000)
  for (let i = 0; i < 100_000; i++) history.append('x')
  // A one-character PTY stream must not retain one array slot per character.
  expect((history as unknown as { chunks: string[] }).chunks.length).toBeLessThan(1000)
  expect(history.text()).toBe('x'.repeat(100_000))
})

it('rejects invalid history limits rather than looping on overflow', () => {
  for (const limit of [0, -1, 1.5, Infinity, NaN]) expect(() => new TerminalHistory(limit)).toThrow()
})

it('can clear all output before a new session generation', () => {
  const history = new TerminalHistory(20)
  history.append('old history')
  history.clear()
  expect(history.text()).toBe('')
  history.append('new')
  expect(history.text()).toBe('new')
})
