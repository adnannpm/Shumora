// @vitest-environment jsdom
import React from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Provider } from '../src/renderer/src/Provider'
import { Packages } from '../src/renderer/src/Packages'
afterEach(cleanup)

const baseQuery = { page: 1, search: '', type: '', sort: 'downloads' }

it('keeps cached cards visible on remount, refresh and refresh failure', async () => {
  const data = { items: [{ name: 'cached-tools', description: 'Tools', author: 'Demo', types: ['extension'], downloads: 10, version: '1.0.0' }], page: 1, pages: 1 }
  let rejectRefresh!: (error: Error) => void
  const catalog = vi.fn().mockResolvedValueOnce(data).mockImplementation(() => new Promise((_, reject) => { rejectRefresh = reject }))
  window.packages = { catalog } as any
  const content = <Provider><div className="library-tabs"><Packages query={baseQuery} onQueryChange={() => {}} onSelect={() => {}} /></div></Provider>
  const first = render(content)
  await screen.findByRole('button', { name: 'View cached-tools' })
  const scroller = first.container.querySelector('.library-tabs')!
  scroller.scrollTop = 240
  fireEvent.scroll(scroller)
  first.unmount()
  const second = render(content)
  expect(second.container.querySelector('.library-tabs')!.scrollTop).toBe(240)
  expect(screen.getByRole('button', { name: 'View cached-tools' })).toBeTruthy()
  expect(screen.queryByLabelText('Loading packages')).toBeNull()
  await waitFor(() => expect(catalog).toHaveBeenCalledTimes(2))
  rejectRefresh(new Error('offline'))
  await screen.findByRole('alert')
  expect(screen.getByRole('button', { name: 'View cached-tools' })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Refresh' }))
  expect(screen.getByRole('button', { name: 'View cached-tools' })).toBeTruthy()
  await waitFor(() => expect(catalog).toHaveBeenCalledTimes(3))
})

it('does not show a previous query as results for an uncached search', async () => {
  const catalog = vi.fn().mockResolvedValueOnce({ items: [{ name: 'old-result', description: '', author: 'Demo', types: [], downloads: 0, version: '1' }], page: 1, pages: 1 }).mockImplementation(() => new Promise(() => {}))
  window.packages = { catalog } as any
  const props = { onQueryChange() {}, onSelect() {} }
  const view = render(<Provider><Packages {...props} query={baseQuery} /></Provider>)
  await screen.findByRole('button', { name: 'View old-result' })
  view.rerender(<Provider><Packages {...props} query={{ ...baseQuery, search: 'different' }} /></Provider>)
  expect(screen.queryByRole('button', { name: 'View old-result' })).toBeNull()
  expect(screen.getByLabelText('Loading packages')).toBeTruthy()
})

it('loads real catalog data, shows a compact identity fallback without a thumbnail, and selects a package', async () => {
  window.packages = { catalog: async () => ({ items: [{ name: 'demo-tools', description: 'Tools', author: 'Demo', types: ['extension'], downloads: 10, version: '1.2.3' }], page: 1, pages: 2 }) } as any
  const onSelect = vi.fn()
  render(<Provider><Packages query={baseQuery} onQueryChange={() => {}} onSelect={onSelect} banner={<div>Updates banner</div>} /></Provider>)
  expect(screen.getByText('Updates banner')).toBeTruthy()
  // No thumbnail: falls back to a compact identity badge, not a large placeholder image.
  expect(screen.queryByRole('img')).toBeNull()
  expect(await screen.findByText('DE')).toBeTruthy()
  fireEvent.click(await screen.findByRole('button', { name: 'View demo-tools' }))
  expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ name: 'demo-tools' }))
})

it('shows thumbnails in cards and falls back to the identity badge when an image fails', async () => {
  window.packages = { catalog: async () => ({ items: [{ name: 'preview-demo', description: 'Preview', author: 'Demo', types: ['theme'], downloads: 1, version: '1.0.0', thumbnail: 'https://images.example.com/demo.png' }], page: 1, pages: 1 }) } as any
  render(<Provider><Packages query={baseQuery} onQueryChange={() => {}} onSelect={() => {}} /></Provider>)
  const image = await screen.findByRole('img', { name: 'preview-demo preview' })
  expect(image.getAttribute('src')).toBe('https://images.example.com/demo.png')
  fireEvent.error(image)
  expect(screen.queryByRole('img', { name: 'preview-demo preview' })).toBeNull()
  expect(screen.getByText('PR')).toBeTruthy()
})

it('preserves search/filter/page state across the parent instead of resetting it internally', async () => {
  const catalog = vi.fn(async () => ({ items: [], page: 2, pages: 3 }))
  window.packages = { catalog } as any
  const onQueryChange = vi.fn()
  render(<Provider><Packages query={{ page: 2, search: 'theme pack', type: 'theme', sort: 'name' }} onQueryChange={onQueryChange} onSelect={() => {}} /></Provider>)
  await screen.findByText('Page 2 of 3')
  expect(catalog).toHaveBeenCalledWith({ page: 2, search: 'theme pack', type: 'theme', sort: 'name' })
  fireEvent.click(screen.getByRole('button', { name: 'Next' }))
  expect(onQueryChange).toHaveBeenCalledWith({ page: 3 })
})
