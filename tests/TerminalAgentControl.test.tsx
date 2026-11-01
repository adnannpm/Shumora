// @vitest-environment jsdom
import React from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Provider } from '../src/renderer/src/Provider'
import { TerminalAgentControl } from '../src/renderer/src/TerminalAgentControl'
import type { TerminalAgentState } from '../src/shared/terminal-agent'

afterEach(() => { cleanup(); delete window.terminalAgent })

it('shows loading until detection finishes without claiming agents are missing', async () => {
  let resolve!: (state: TerminalAgentState) => void
  window.terminalAgent = {
    status: () => new Promise(resolveStatus => { resolve = resolveStatus }),
    select: vi.fn()
  }
  render(<Provider><TerminalAgentControl /></Provider>)
  expect(screen.getByRole('status').textContent).toBe('Loading terminal agents…')
  expect(screen.getByRole('combobox', { name: 'Terminal agent' })).toHaveProperty('disabled', true)
  expect(screen.queryByText(/Install missing agents/)).toBeNull()
  resolve({ active: 'pi', canChange: true, installed: { pi: true, opencode: true } })
  await waitFor(() => expect(screen.queryByText('Loading terminal agents…')).toBeNull())
  expect(screen.getByRole('combobox', { name: 'Terminal agent' })).toHaveProperty('disabled', false)
})

it('shows saving feedback until the selected agent is persisted', async () => {
  const state: TerminalAgentState = { active: 'pi', canChange: true, installed: { pi: true, opencode: true } }
  let resolve!: (state: TerminalAgentState) => void
  window.terminalAgent = {
    status: async () => state,
    select: () => new Promise(resolveSelect => { resolve = resolveSelect })
  }
  render(<Provider><TerminalAgentControl /></Provider>)
  const select = screen.getByRole('combobox', { name: 'Terminal agent' })
  await waitFor(() => expect(select).toHaveProperty('disabled', false))
  fireEvent.change(select, { target: { value: 'opencode' } })
  expect(screen.getByRole('status').textContent).toBe('Saving terminal agent…')
  expect(select).toHaveProperty('disabled', true)
  resolve({ ...state, active: 'opencode' })
  await screen.findByText('OpenCode is active for new terminal sessions.')
  expect(select).toHaveProperty('disabled', false)
})

it('renders the active agent, disables switching while tabs are open, and explains why', async () => {
  const state: TerminalAgentState = { active: 'pi', canChange: false, installed: { pi: true, opencode: true } }
  window.terminalAgent = {
    status: vi.fn(async () => state),
    select: vi.fn(async (agent) => ({ ...state, active: agent }))
  }
  render(<Provider><TerminalAgentControl /></Provider>)
  await screen.findByRole('combobox', { name: 'Terminal agent' })
  expect(screen.getByRole('combobox', { name: 'Terminal agent' })).toHaveProperty('disabled', true)
  expect(screen.getByText('Close all terminal tabs to switch the agent.')).toBeTruthy()
})

it('switches the active agent when no tabs are open and both are installed', async () => {
  let current: TerminalAgentState = { active: 'pi', canChange: true, installed: { pi: true, opencode: true } }
  window.terminalAgent = {
    status: vi.fn(async () => current),
    select: vi.fn(async (agent) => { current = { ...current, active: agent }; return current })
  }
  render(<Provider><TerminalAgentControl /></Provider>)
  const select = await screen.findByRole('combobox', { name: 'Terminal agent' })
  expect(select).toHaveProperty('disabled', false)
  fireEvent.change(select, { target: { value: 'opencode' } })
  await waitFor(() => expect(window.terminalAgent?.select).toHaveBeenCalledWith('opencode'))
  expect(await screen.findByText('OpenCode is active for new terminal sessions.')).toBeTruthy()
})

it('disables uninstalled agents in the dropdown and explains where to install them', async () => {
  const state: TerminalAgentState = { active: 'pi', canChange: true, installed: { pi: true, opencode: false } }
  window.terminalAgent = {
    status: vi.fn(async () => state),
    select: vi.fn(async () => state)
  }
  render(<Provider><TerminalAgentControl /></Provider>)
  await screen.findByRole('combobox', { name: 'Terminal agent' })
  const option = screen.getByRole('option', { name: /OpenCode.*not installed/i }) as HTMLOptionElement
  expect(option.disabled).toBe(true)
  expect(screen.getByText(/Install missing agents from Library/i)).toBeTruthy()
})
