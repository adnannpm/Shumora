// @vitest-environment jsdom
import React from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Provider } from '../src/renderer/src/Provider'
import { AppCheckbox } from '../src/renderer/src/AppCheckbox'
afterEach(cleanup)
it('exposes its label and forwards boolean changes from the Chakra control', async () => {
  const change = vi.fn()
  render(<Provider><AppCheckbox checked={false} onCheckedChange={change}>Remember session</AppCheckbox></Provider>)
  fireEvent.click(screen.getByRole('checkbox', { name: 'Remember session' }))
  await waitFor(() => expect(change).toHaveBeenCalledWith(true))
})
it('keeps disabled checkboxes unavailable and preserves controlled checked state', () => {
  const change = vi.fn()
  render(<Provider><AppCheckbox checked disabled aria-label="Invite agent" onCheckedChange={change} /></Provider>)
  const input = screen.getByRole('checkbox', { name: 'Invite agent' }) as HTMLInputElement
  expect(input.checked).toBe(true)
  expect(input.disabled).toBe(true)
})
