// @vitest-environment jsdom
import React from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { Provider } from '../src/renderer/src/Provider'
import { Packages } from '../src/renderer/src/Packages'
afterEach(cleanup)

const baseQuery = { page: 1, search: '', type: '', sort: 'downloads' }

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
