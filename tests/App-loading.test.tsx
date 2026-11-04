// @vitest-environment jsdom
import React from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

// Hold the page chunks pending to reproduce a slow first navigation reliably.
vi.mock('../src/renderer/src/Library', async () => { await new Promise(() => {}); return {} })
vi.mock('../src/renderer/src/RouterDashboard', async () => { await new Promise(() => {}); return {} })
import App from '../src/renderer/src/App'
import { Provider } from '../src/renderer/src/Provider'

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
  vi.stubGlobal('localStorage', { getItem: () => 'true', setItem() {} })
  window.workspace = { list: async () => [], onEvent: () => () => {}, folder: async () => '/tmp' } as any
  window.piPlugin = { status: async () => ({ installed: true }) } as any
  window.plugins = { status: async () => ({ id: '9router', installed: true }) } as any
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

it.each(['Library', '9router'])('shows a skeleton rather than loading text while the %s chunk loads', async name => {
  const { container } = render(<Provider><App /></Provider>)
  fireEvent.click(await screen.findByRole('button', { name }))
  expect(screen.queryByText('Loading…')).toBeNull()
  expect(screen.getByRole('heading', { name, level: 1 })).toBeTruthy()
  expect(container.querySelector('[aria-busy="true"] .chakra-skeleton')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Terminals' }))
  expect(container.querySelector('.page-skeleton')).toBeNull()
})
