// @vitest-environment jsdom
import React from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { Provider } from '../src/renderer/src/Provider'
import { Library } from '../src/renderer/src/Library'

const originalNodePlugin = window.nodePlugin
beforeEach(() => vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} }))
afterEach(() => { cleanup(); vi.unstubAllGlobals(); window.nodePlugin = originalNodePlugin })

it('combines case-insensitive plugin search with category filtering and shows empty results', async () => {
  render(<Provider><Library /></Provider>)
  fireEvent.click(screen.getByRole('tab', { name: 'Plugins' }))
  const search = await screen.findByRole('searchbox', { name: 'Search plugins' })
  const category = screen.getByRole('combobox', { name: 'Plugin category' })
  fireEvent.change(category, { target: { value: 'agent' } })
  expect(screen.getByRole('button', { name: 'Open Pi plugin' })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Open OpenCode plugin' })).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Open Node.js plugin' })).toBeNull()
  fireEvent.change(search, { target: { value: '  OPENCODE  ' } })
  expect(screen.getByRole('button', { name: 'Open OpenCode plugin' })).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Open Pi plugin' })).toBeNull()
  fireEvent.change(category, { target: { value: 'runtime' } })
  expect(screen.getByText('No matching plugins.')).toBeTruthy()
  fireEvent.change(search, { target: { value: 'javascript' } })
  expect(screen.getByRole('button', { name: 'Open Node.js plugin' })).toBeTruthy()
  expect(screen.queryByText('No matching plugins.')).toBeNull()
})

it('keeps plugin search and category after visiting details and switching tabs', async () => {
  window.nodePlugin = { status: async () => ({ installed: true, installedVersion: '22.0.0' }) }
  render(<Provider><Library /></Provider>)
  fireEvent.click(screen.getByRole('tab', { name: 'Plugins' }))
  fireEvent.change(await screen.findByRole('searchbox', { name: 'Search plugins' }), { target: { value: 'node' } })
  fireEvent.change(screen.getByRole('combobox', { name: 'Plugin category' }), { target: { value: 'runtime' } })
  fireEvent.click(screen.getByRole('button', { name: 'Open Node.js plugin' }))
  await screen.findByText('22.0.0')
  fireEvent.click(screen.getByRole('button', { name: 'Back to plugins' }))
  expect(screen.getByRole('searchbox', { name: 'Search plugins' })).toHaveProperty('value', 'node')
  expect(screen.getByRole('combobox', { name: 'Plugin category' })).toHaveProperty('value', 'runtime')
  fireEvent.click(screen.getByRole('tab', { name: 'Packages' }))
  fireEvent.click(screen.getByRole('tab', { name: 'Plugins' }))
  expect(await screen.findByRole('searchbox', { name: 'Search plugins' })).toHaveProperty('value', 'node')
  expect(screen.queryByRole('button', { name: 'Open Pi plugin' })).toBeNull()
})
