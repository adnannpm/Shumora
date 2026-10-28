// @vitest-environment jsdom
import React from 'react'
import { afterEach, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { Provider } from '../src/renderer/src/Provider'
import { Sidebar } from '../src/renderer/src/Sidebar'
afterEach(cleanup)
it('uses a team icon for Council distinct from the router icon in both sidebar layouts', () => {
  const props = { page: 'meeting' as const, onPage() {}, collapsed: false, onToggle() {}, routerInstalled: true }
  const view = render(<Provider><Sidebar {...props} /></Provider>)
  for (const collapsed of [false, true]) {
    view.rerender(<Provider><Sidebar {...props} collapsed={collapsed} /></Provider>)
    const council = screen.getByRole('button', { name: 'Council' })
    const icon = council.querySelector('svg')!
    expect(icon.querySelector('circle')).toBeTruthy()
    expect(icon.innerHTML).not.toBe(screen.getByRole('button', { name: '9router' }).querySelector('svg')!.innerHTML)
    expect(icon.getAttribute('aria-hidden')).toBe('true')
    expect(council.getAttribute('aria-current')).toBe('page')
  }
})
it('shows 9router integration only when the plugin is installed', () => {
  const props = { page: 'library' as const, onPage() {}, collapsed: false, onToggle() {} }
  const view = render(<Provider><Sidebar {...props} routerInstalled={false} /></Provider>)
  expect(screen.queryByRole('button', { name: '9router' })).toBeNull()
  expect(screen.getByRole('button', { name: 'Library' }).getAttribute('aria-current')).toBe('page')
  view.rerender(<Provider><Sidebar {...props} routerInstalled /></Provider>)
  expect(screen.getByRole('button', { name: '9router' })).toBeTruthy()
})
