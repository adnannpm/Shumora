// @vitest-environment jsdom
import React from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within, waitFor } from '@testing-library/react'
import { Provider } from '../src/renderer/src/Provider'
import { RouterProviders, RouterModels } from '../src/renderer/src/RouterCatalog'
afterEach(cleanup)
it('shows skeletons while provider and model data are pending', () => {
  window.plugins = { routerProviders: () => new Promise(() => {}), routerModels: () => new Promise(() => {}) } as any
  const view = render(<Provider><RouterProviders /></Provider>)
  expect(screen.getByRole('status', { name: 'Loading providers' }).getAttribute('aria-busy')).toBe('true')
  expect(screen.queryByText('No provider connections yet.')).toBeNull()
  view.unmount()
  render(<Provider><RouterModels /></Provider>)
  expect(screen.getByRole('status', { name: 'Loading models' })).toBeTruthy()
  expect(screen.queryByText('No matching models.')).toBeNull()
})
it('shows actual connections and confirms before deletion', async () => {
  const remove = vi.fn()
  window.plugins = { routerProviders: async () => [{ id: 'a', provider: 'openai', name: 'Work', active: true, status: 'valid' }], routerRemoveProvider: remove } as any
  render(<Provider><RouterProviders /></Provider>)
  await screen.findByText('Work')
  fireEvent.click(screen.getByRole('button', { name: 'Delete Work' }))
  expect(remove).not.toHaveBeenCalled()
  fireEvent.click(await screen.findByRole('button', { name: 'Confirm delete' }))
  expect(remove).toHaveBeenCalledWith('a')
})
it('submits provider credentials only on explicit form submission', async () => {
  const add = vi.fn().mockResolvedValue(undefined)
  window.plugins = { routerProviders: async () => [], routerAddProvider: add } as any
  render(<Provider><RouterProviders /></Provider>)
  fireEvent.change(screen.getByLabelText('Connection name'), { target: { value: 'Personal' } })
  fireEvent.change(screen.getByLabelText('Provider API key'), { target: { value: 'private-key' } })
  await screen.findByText('No provider connections yet.')
  expect(add).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Add connection' }))
  expect(add).toHaveBeenCalledWith({ provider: 'openai', name: 'Personal', apiKey: 'private-key' })
})
it('opens official OAuth login and submits custom endpoint configuration', async () => {
  const oauth = vi.fn().mockResolvedValue(undefined)
  const custom = vi.fn().mockResolvedValue('openai-compatible-local')
  window.plugins = { routerProviders: async () => [], routerOpenOAuth: oauth, routerCustomProvider: custom } as any
  render(<Provider><RouterProviders /></Provider>)
  await screen.findByText('No provider connections yet.')
  fireEvent.click(screen.getByRole('button', { name: 'Connect OAuth account in browser' }))
  expect(oauth).toHaveBeenCalledOnce()
  await screen.findByText(/In the browser, select your provider/)
  fireEvent.change(screen.getByLabelText('Endpoint name'), { target: { value: 'Local' } })
  fireEvent.change(screen.getByLabelText('Model prefix'), { target: { value: 'local' } })
  fireEvent.change(screen.getByLabelText('Base URL'), { target: { value: 'http://localhost:11434/v1' } })
  fireEvent.click(screen.getByRole('button', { name: 'Create endpoint' }))
  expect(custom).toHaveBeenCalledWith({ name: 'Local', prefix: 'local', baseUrl: 'http://localhost:11434/v1', type: 'openai-compatible', apiType: 'chat' })
  await screen.findByText(/Endpoint created/)
  expect((screen.getByLabelText('Provider ID') as HTMLInputElement).value).toBe('openai-compatible-local')
})
it('edits connection names without replacing credentials implicitly', async () => {
  const edit = vi.fn().mockResolvedValue(undefined)
  window.plugins = { routerProviders: async () => [{ id: 'a', provider: 'openai', name: 'Work', active: true }], routerEditProvider: edit } as any
  render(<Provider><RouterProviders /></Provider>)
  fireEvent.click(await screen.findByRole('button', { name: 'Edit Work' }))
  const dialog = await screen.findByRole('dialog')
  fireEvent.change(within(dialog).getByLabelText('Connection name'), { target: { value: 'Renamed' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save connection' }))
  expect(edit).toHaveBeenCalledWith('a', { name: 'Renamed' })
})
it('explains dashboard authentication failures instead of blaming aliases', async () => {
  window.plugins = { routerModels: async () => { throw new Error('9router requires dashboard login. Authenticated integration is not available yet.') } } as any
  render(<Provider><RouterModels /></Provider>)
  expect((await screen.findByRole('alert')).textContent).toContain('requires dashboard login')
})
it('filters real models and edits aliases', async () => {
  const alias = vi.fn()
  const enabled = vi.fn().mockResolvedValue(undefined)
  window.plugins = { routerModelEnabled: enabled, routerModels: async () => [{ id: 'openai/gpt-4.1', name: 'GPT 4.1', provider: 'openai', alias: 'gpt-4.1', enabled: true, providerAlias: 'openai', modelId: 'gpt-4.1' }], routerModelAlias: alias } as any
  render(<Provider><RouterModels /></Provider>)
  await screen.findByText('GPT 4.1')
  await waitFor(() => expect((screen.getByRole('button', { name: 'Disable GPT 4.1' }) as HTMLButtonElement).disabled).toBe(false))
  fireEvent.change(screen.getByRole('textbox', { name: 'Alias for GPT 4.1' }), { target: { value: 'coding' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save alias for GPT 4.1' }))
  expect(alias).toHaveBeenCalledWith('openai/gpt-4.1', 'coding')
  await waitFor(() => expect((screen.getByRole('button', { name: 'Disable GPT 4.1' }) as HTMLButtonElement).disabled).toBe(false))
  fireEvent.click(screen.getByRole('button', { name: 'Disable GPT 4.1' }))
  expect(enabled).toHaveBeenCalledWith('openai', 'gpt-4.1', false)
  fireEvent.change(screen.getByRole('textbox', { name: 'Search models' }), { target: { value: 'missing' } })
  expect(screen.queryByText('GPT 4.1')).toBeNull()
})
