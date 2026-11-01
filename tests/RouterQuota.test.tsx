// @vitest-environment jsdom
import React from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { Provider } from '../src/renderer/src/Provider'
import { RouterQuota } from '../src/renderer/src/RouterQuota'
afterEach(cleanup)
it('summarizes account health and filters by quota state, provider and plan without treating unknown balances as zero', async () => {
  window.plugins = {
    routerProviders: async () => [
      { id: 'low', name: 'Work', provider: 'claude', active: true, status: 'active' },
      { id: 'unknown', name: 'API', provider: 'custom', active: true, status: 'active' },
      { id: 'off', name: 'Paused', provider: 'gemini', active: false, status: 'inactive' },
      { id: 'failed', name: 'Broken', provider: 'openai', active: true, status: 'active' }
    ],
    routerQuota: async (id: string) => {
      if (id === 'failed') throw new Error('private details')
      return { checkedAt: new Date().toISOString(), plan: id === 'low' ? 'Pro' : undefined, quotas: id === 'unknown' ? [] : [{ name: 'weekly', remainingPercentage: 10, unlimited: false }] }
    }
  } as any
  render(<Provider><RouterQuota /></Provider>)
  const summary = await screen.findByRole('region', { name: 'Account summary' })
  await screen.findByText(/Could not refresh quota/)
  expect(within(summary).getByLabelText('Connected accounts').textContent).toContain('4')
  expect(within(summary).getByLabelText('Low quota').textContent).toContain('1')
  expect(within(summary).getByLabelText('Refresh failed').textContent).toContain('1')
  fireEvent.change(screen.getByRole('combobox', { name: 'Filter accounts' }), { target: { value: 'low' } })
  expect(screen.getByRole('region', { name: 'Work' })).toBeTruthy()
  expect(screen.queryByRole('region', { name: 'API' })).toBeNull()
  expect(screen.queryByRole('region', { name: 'Paused' })).toBeNull()
  fireEvent.change(screen.getByRole('combobox', { name: 'Filter accounts' }), { target: { value: 'all' } })
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'PRO' } })
  expect(screen.getByRole('region', { name: 'Work' })).toBeTruthy()
  expect(screen.queryByRole('region', { name: 'API' })).toBeNull()
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'no match' } })
  expect(screen.getByText('No matching accounts.')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }))
  expect(screen.getByRole('region', { name: 'API' })).toBeTruthy()
})
it('keeps unlimited and unreported quota distinct and does not render invalid reset dates', async () => {
  window.plugins = {
    routerProviders: async () => [{ id: 'one', name: 'Personal', provider: 'claude', active: true, status: 'active' }],
    routerQuota: async () => ({ checkedAt: new Date().toISOString(), quotas: [
      { name: 'requests', unlimited: true, remainingPercentage: 0 },
      { name: 'credits', unlimited: false, used: 4, resetAt: 'invalid' }
    ] })
  } as any
  render(<Provider><RouterQuota /></Provider>)
  expect(await screen.findByText('Unlimited')).toBeTruthy()
  expect(screen.getByText('Remaining quota not provided')).toBeTruthy()
  expect(screen.queryByRole('meter')).toBeNull()
  expect(screen.queryByText(/Invalid Date|NaNh/)).toBeNull()
  expect(screen.getAllByText('Reset time not provided')).toHaveLength(1)
})
it('colors remaining quota green above half, yellow through the middle and red at twenty percent or less', async () => {
  window.plugins = {
    routerProviders: async () => [{ id: 'one', name: 'Colors', provider: 'custom', active: true, status: 'active' }],
    routerQuota: async () => ({ checkedAt: new Date().toISOString(), quotas: [
      { name: 'Full', remainingPercentage: 100, unlimited: false },
      { name: 'Middle', remainingPercentage: 50, unlimited: false },
      { name: 'Low credits', remaining: 20, total: 100, unlimited: false }
    ] })
  } as any
  render(<Provider><RouterQuota /></Provider>)
  expect((await screen.findByRole('meter', { name: 'Full Remaining quota' })).closest('.router-quota-window')?.classList.contains('quota-healthy')).toBe(true)
  expect(screen.getByRole('meter', { name: 'Middle Remaining quota' }).closest('.router-quota-window')?.classList.contains('quota-warning')).toBe(true)
  expect(screen.getByRole('meter', { name: 'Low credits Remaining quota' }).closest('.router-quota-window')?.classList.contains('quota-danger')).toBe(true)
})
it('limits long model lists per account and expands them independently without hiding account warnings', async () => {
  window.plugins = {
    routerProviders: async () => ['one', 'two'].map(id => ({ id, name: id, provider: 'custom', active: true, status: 'active' })),
    routerQuota: async () => ({ checkedAt: new Date().toISOString(), quotas: Array.from({ length: 8 }, (_, i) => ({ name: `Model ${i + 1}`, remainingPercentage: i === 7 ? 5 : 90, unlimited: false })) })
  } as any
  render(<Provider><RouterQuota /></Provider>)
  const first = within(await screen.findByRole('region', { name: 'one' }))
  await first.findByRole('meter', { name: 'Model 1 Remaining quota' })
  expect(first.getAllByRole('meter')).toHaveLength(3)
  expect(first.getByText('Low quota')).toBeTruthy()
  expect(first.queryByText('Model 8')).toBeNull()
  fireEvent.click(first.getByRole('button', { name: 'Show all 8 models' }))
  expect(first.getAllByRole('meter')).toHaveLength(8)
  expect(first.getByRole('button', { name: 'Show fewer' }).getAttribute('aria-expanded')).toBe('true')
  const second = within(screen.getByRole('region', { name: 'two' }))
  expect(second.getAllByRole('meter')).toHaveLength(3)
  fireEvent.click(first.getByRole('button', { name: 'Show fewer' }))
  expect(first.getAllByRole('meter')).toHaveLength(3)
})
it('shows credit balance bars using reported totals and marks balance-only credits as unscaled', async () => {
  window.plugins = {
    routerProviders: async () => [{ id: 'one', name: 'Credits', provider: 'custom', active: true, status: 'active' }],
    routerQuota: async () => ({ checkedAt: new Date().toISOString(), quotas: [
      { name: 'Monthly credits', remaining: 15, total: 100, unlimited: false },
      { name: 'Used credits', used: 75, total: 100, unlimited: false },
      { name: 'Wallet', remaining: 42, unlimited: false }
    ] })
  } as any
  render(<Provider><RouterQuota /></Provider>)
  expect((await screen.findByRole('meter', { name: 'Monthly credits Remaining quota' })).getAttribute('value')).toBe('15')
  expect(screen.getByRole('meter', { name: 'Used credits Remaining quota' }).getAttribute('value')).toBe('25')
  expect(screen.getByText('15 remaining')).toBeTruthy()
  expect(screen.getByText('42 remaining')).toBeTruthy()
  expect(screen.getByRole('img', { name: 'Wallet: total credit limit not provided' })).toBeTruthy()
  expect(screen.queryByRole('meter', { name: 'Wallet Remaining quota' })).toBeNull()
  expect(screen.getByText('Total credit limit not provided')).toBeTruthy()
  expect(screen.getByRole('region', { name: 'Credits' }).textContent).toContain('Low quota')
})
it('shows a loading state, a recoverable account-list error, and an empty state after retry', async () => {
  let reject!: (error: Error) => void
  window.plugins = { routerProviders: () => new Promise((_, fail) => { reject = fail }) } as any
  render(<Provider><RouterQuota /></Provider>)
  expect(screen.getByRole('status', { name: 'Loading account quotas…' })).toBeTruthy()
  reject(new Error('private error'))
  expect(await screen.findByRole('alert')).toBeTruthy()
  expect(screen.queryByText('private error')).toBeNull()
  window.plugins.routerProviders = async () => []
  fireEvent.click(screen.getByRole('button', { name: 'Refresh' }))
  expect(await screen.findByText('No connected accounts')).toBeTruthy()
  expect(screen.queryByRole('alert')).toBeNull()
})
it('shows quota and reset windows independently from unsupported accounts', async () => {
  window.plugins = {
    routerProviders: async () => [{ id: 'one', name: 'Personal', provider: 'claude', active: true }, { id: 'two', name: 'API account', provider: 'custom', active: true }],
    routerQuota: async (id: string) => ({ checkedAt: new Date().toISOString(), quotas: id === 'one' ? [{ name: 'weekly', used: 40, total: 100, remainingPercentage: 60, resetAt: new Date(Date.now() + 7200000).toISOString(), unlimited: false }] : [] })
  } as any
  render(<Provider><RouterQuota /></Provider>)
  expect(await screen.findByText('60% remaining')).toBeTruthy()
  expect(screen.getByText(/Resets in/)).toBeTruthy()
  expect(await screen.findByText('Quota or credit balance is not provided for this account. Check the provider dashboard.')).toBeTruthy()
  expect(screen.getByRole('link', { name: /Open 9router quota dashboard/ }).getAttribute('href')).toContain('/dashboard/quota')
  window.plugins.routerQuota = vi.fn().mockRejectedValue(new Error('Bearer secret'))
  fireEvent.click(screen.getByRole('button', { name: 'Refresh' }))
  expect((await screen.findAllByText(/Could not refresh quota/)).length).toBe(2)
  expect(screen.getByText('60% remaining')).toBeTruthy()
  expect(screen.queryByText(/Bearer secret/)).toBeNull()
})
