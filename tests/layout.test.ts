import { expect, it } from 'vitest'
import { initialLayout, layoutReducer as reduce, layoutRects } from '../src/renderer/src/layout'
it('reorders tabs and moves them between groups without duplicating sessions', () => {
  let s = reduce(initialLayout, { type: 'init', ids: ['a', 'b', 'c'] })
  s = reduce(s, { type: 'drop', id: 'c', group: 0, before: 'a' })
  expect(s.groups[0].ids).toEqual(['c', 'a', 'b'])
  s = reduce(s, { type: 'split', orientation: 'right' })
  s = reduce(s, { type: 'drop', id: 'a', group: 1, before: 'c' })
  expect(s.groups.map(g => g.ids)).toEqual([['b'], ['a', 'c']])
  s = reduce(s, { type: 'drop', id: 'b', group: 1 })
  expect(s.groups).toEqual([{ ids: ['a', 'c', 'b'], active: 'b' }])
  expect(reduce(s, { type: 'drop', id: 'unknown', group: 0 })).toEqual(s)
})
it('splits by moving a tab, without duplicating session identities', () => {
  let s = reduce(initialLayout, { type: 'init', ids: ['a', 'b', 'c'] })
  s = reduce(s, { type: 'select', group: 0, id: 'b' })
  s = reduce(s, { type: 'split', orientation: 'right' })
  expect(s.groups.map(g => g.ids)).toEqual([['a', 'c'], ['b']])
  expect(s.focused).toBe(1)
  s = reduce(s, { type: 'select', group: 0, id: 'a' })
  s = reduce(s, { type: 'move', group: 0 })
  expect(s.groups.map(g => g.ids)).toEqual([['c'], ['b', 'a']])
  s = reduce(s, { type: 'merge' })
  expect(s.groups).toHaveLength(1); expect(new Set(s.groups[0].ids).size).toBe(3)
})
it('creates an explicit split partner for a single tab and collapses empty groups', () => {
  let s = reduce(initialLayout, { type: 'init', ids: ['a'] })
  s = reduce(s, { type: 'split', orientation: 'down', newId: 'b' })
  expect(s.orientation).toBe('down'); expect(s.groups.map(g => g.ids)).toEqual([['a'], ['b']])
  s = reduce(s, { type: 'remove', id: 'a' })
  expect(s.groups.map(g => g.ids)).toEqual([['b']]); expect(s.focused).toBe(0)
  s = reduce(s, { type: 'remove', id: 'b' })
  expect(s.groups).toEqual([{ ids: [], active: '' }])
})
it('adds to the requested group and preserves active tabs on unrelated close', () => {
  let s = reduce(initialLayout, { type: 'init', ids: ['a', 'b'] })
  s = reduce(s, { type: 'split', orientation: 'right' })
  s = reduce(s, { type: 'add', id: 'c', group: 0 })
  s = reduce(s, { type: 'remove', id: 'b' })
  expect(s.groups[0].active).toBe('c')
  expect(s.groups.flatMap(g => g.ids).sort()).toEqual(['a', 'c'])
})

it('splits the focused pane up to four and preserves the remaining tree on close', () => {
  let s = reduce(initialLayout, { type: 'init', ids: ['a'] })
  s = reduce(s, { type: 'split', orientation: 'right', newId: 'b' })
  s = reduce(s, { type: 'split', orientation: 'down', newId: 'c' })
  s = reduce(s, { type: 'focus', group: 0 })
  s = reduce(s, { type: 'split', orientation: 'down', newId: 'd' })
  expect(s.groups.map(g => g.ids)).toEqual([['a'], ['b'], ['c'], ['d']])
  expect(layoutRects(s.tree).panes).toEqual({
    0: { left: 0, top: 0, width: 50, height: 50 },
    1: { left: 50, top: 0, width: 50, height: 50 },
    2: { left: 50, top: 50, width: 50, height: 50 },
    3: { left: 0, top: 50, width: 50, height: 50 }
  })
  expect(reduce(s, { type: 'split', orientation: 'right', newId: 'e' })).toBe(s)
  s = reduce(s, { type: 'remove', id: 'b' })
  expect(s.groups.map(g => g.ids)).toEqual([['a'], ['c'], ['d']])
  expect(s.tree).toEqual({ orientation: 'right', ratio: 50, first: { orientation: 'down', ratio: 50, first: 0, second: 2 }, second: 1 })
})
it('resizes only the requested split and clamps its ratio', () => {
  let s = reduce(initialLayout, { type: 'init', ids: ['a'] })
  s = reduce(s, { type: 'split', orientation: 'right', newId: 'b' })
  s = reduce(s, { type: 'split', orientation: 'down', newId: 'c' })
  s = reduce(s, { type: 'resize', path: 'second', ratio: 90 })
  expect(s.tree).toEqual({ orientation: 'right', ratio: 50, first: 0, second: { orientation: 'down', ratio: 75, first: 1, second: 2 } })
})
