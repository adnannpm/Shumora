// @vitest-environment jsdom
import React from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Provider } from '../src/renderer/src/Provider'
import { RouterAuth } from '../src/renderer/src/RouterAuth'
afterEach(cleanup)
it('signs in explicitly, clears the password and notifies data views', async () => {
  let authenticated = false
  const login = vi.fn(async () => { authenticated = true })
  window.plugins = { routerAuthStatus: async () => ({ authenticated, required: true }), routerLogin: login } as any
  const changed = vi.fn()
  render(<Provider><RouterAuth onChange={changed} /></Provider>)
  fireEvent.click(await screen.findByRole('button', { name: 'Sign in to 9router' }))
  const input = await screen.findByLabelText('Dashboard password')
  fireEvent.change(input, { target: { value: 'private-password' } })
  expect(login).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: /^Sign in$/ }))
  await waitFor(() => expect(changed).toHaveBeenCalledOnce())
  expect(login).toHaveBeenCalledWith('private-password')
  await screen.findByRole('button', { name: 'Sign out of 9router' })
  expect((input as HTMLInputElement).value).toBe('')
  // Chakra retains the dialog during its exit animation. Wait for unmount,
  // rather than racing the animation after the header has already updated.
  await waitFor(() => expect(screen.queryByLabelText('Dashboard password')).toBeNull())
})
