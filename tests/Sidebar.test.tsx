// @vitest-environment jsdom
import React from 'react'
import { afterEach, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { Provider } from '../src/renderer/src/Provider'
import { Sidebar } from '../src/renderer/src/Sidebar'
afterEach(cleanup)
it('shows 9router integration only when the plugin is installed', () => {
  const props = { page: 'library' as const, onPage() {}, collapsed: false, onToggle() {} }
  const view = render(<Provider><Sidebar {...props} routerInstalled={false} /></Provider>)
  expect(screen.queryByRole('button', { name: '9router' })).toBeNull()
  expect(screen.getByRole('button', { name: 'Library' }).getAttribute('aria-current')).toBe('page')
  view.rerender(<Provider><Sidebar {...props} routerInstalled /></Provider>)
  expect(screen.getByRole('button', { name: '9router' })).toBeTruthy()
})
