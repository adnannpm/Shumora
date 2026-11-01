// @vitest-environment jsdom
import React from 'react'
import { afterEach, expect, it } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { Provider } from '../src/renderer/src/Provider'
import { RouterProviders, RouterModels } from '../src/renderer/src/RouterCatalog'
import { RouterQuota } from '../src/renderer/src/RouterQuota'
afterEach(cleanup)
it('keeps the entire quota data area skeletonized until every account finishes, including refresh', async () => {
  let finish!: (value: any) => void
  const data = { checkedAt: new Date().toISOString(), quotas: [{ name: 'Monthly', remainingPercentage: 80, unlimited: false }] }
  window.plugins = {
    routerProviders: async () => ['Fast', 'Slow'].map(id => ({ id, name: id, provider: 'custom', active: true, status: 'active' })),
    routerQuota: (id: string) => id === 'Fast' ? Promise.resolve(data) : new Promise(resolve => { finish = resolve })
  } as any
  render(<Provider><RouterQuota /></Provider>)
  await act(async () => {})
  expect(screen.getByRole('status', { name: 'Loading account quotas…' })).toBeTruthy()
  expect(screen.queryByRole('heading', { name: 'Fast' })).toBeNull()
  expect(screen.queryByRole('searchbox')).toBeNull()
  expect(screen.queryByText('80% remaining')).toBeNull()
  await act(async () => { finish(data) })
  expect(await screen.findByRole('heading', { name: 'Fast' })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Refresh' }))
  expect(screen.queryByRole('heading', { name: 'Fast' })).toBeNull()
  expect(screen.queryByRole('searchbox')).toBeNull()
  await act(async () => {})
  expect(screen.queryByText('80% remaining')).toBeNull()
  await act(async () => { finish(data) })
  expect(await screen.findByRole('heading', { name: 'Slow' })).toBeTruthy()
})
for (const kind of ['providers', 'models'] as const) {
  it(`shows a skeleton during ${kind} refresh even with cached data`, async () => {
    let pending = false
    window.plugins = {
      routerProviders: () => pending ? new Promise(() => {}) : Promise.resolve([{ id: 'one', name: 'Personal', provider: 'claude', active: true, status: 'active' }]),
      routerModels: () => pending ? new Promise(() => {}) : Promise.resolve([{ id: 'model', name: 'Test model', provider: 'claude', alias: '', enabled: true, providerAlias: 'claude', modelId: 'model' }])
    } as any
    render(<Provider>{kind === 'providers' ? <RouterProviders /> : <RouterModels />}</Provider>)
    await screen.findByRole(kind === 'providers' ? 'heading' : 'row', { name: kind === 'providers' ? 'Personal' : /Test model/ })
    pending = true
    fireEvent.click(screen.getByRole('button', { name: `Refresh ${kind}` }))
    expect(screen.getByRole('status', { name: `Loading ${kind}` })).toBeTruthy()
    expect(screen.queryByRole(kind === 'providers' ? 'heading' : 'row', { name: kind === 'providers' ? 'Personal' : /Test model/ })).toBeNull()
  })
}
it('uses skeletons instead of placeholder numbers while quota summaries load', () => {
  window.plugins = { routerProviders: () => new Promise(() => {}) } as any
  render(<Provider><RouterQuota /></Provider>)
  expect(screen.getByRole('status', { name: 'Account summary' })).toBeTruthy()
  expect(screen.queryByText('—')).toBeNull()
})
