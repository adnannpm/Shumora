// @vitest-environment jsdom
import React from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Provider } from '../src/renderer/src/Provider'
import { RouterAuth } from '../src/renderer/src/RouterAuth'
afterEach(cleanup)
it('toggles password visibility, warns about Caps Lock and resets sensitive state on cancel', async () => {
  window.plugins = { routerAuthStatus: async () => ({ authenticated: false, required: true }) } as any
  render(<Provider><RouterAuth onChange={() => {}} /></Provider>)
  fireEvent.click(await screen.findByRole('button', { name: 'Sign in to 9router' }))
  const input = await screen.findByLabelText('Dashboard password')
  fireEvent.change(input, { target: { value: 'private' } })
  fireEvent.click(screen.getByRole('button', { name: 'Show password' }))
  expect(input.getAttribute('type')).toBe('text')
  fireEvent.keyDown(input, { key: 'A', modifierCapsLock: true })
  expect(screen.getByText('Caps Lock is on')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  fireEvent.click(screen.getByRole('button', { name: 'Sign in to 9router' }))
  const reopened = await screen.findByLabelText('Dashboard password')
  expect((reopened as HTMLInputElement).value).toBe('')
  expect(reopened.getAttribute('type')).toBe('password')
  expect(screen.queryByText('Caps Lock is on')).toBeNull()
})
it('shows pending feedback and a recoverable inline error without retaining the submitted password', async () => {
  let fail!: (reason: Error) => void
  window.plugins = { routerAuthStatus: async () => ({ authenticated: false, required: true }), routerLogin: () => new Promise((_, reject) => { fail = reject }) } as any
  render(<Provider><RouterAuth onChange={() => {}} /></Provider>)
  fireEvent.click(await screen.findByRole('button', { name: 'Sign in to 9router' }))
  const input = await screen.findByLabelText('Dashboard password')
  fireEvent.change(input, { target: { value: 'wrong' } })
  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
  expect(screen.getByRole('button', { name: /Signing in/ }).hasAttribute('disabled')).toBe(true)
  expect((input as HTMLInputElement).value).toBe('')
  fail(new Error('Incorrect dashboard password'))
  expect((await screen.findByRole('alert')).textContent).toContain('Incorrect dashboard password')
  expect(input.getAttribute('aria-invalid')).toBe('true')
  fireEvent.change(input, { target: { value: 'retry' } })
  expect(screen.queryByRole('alert')).toBeNull()
})
it('requires confirmation to sign out and keeps the session when cancelled', async () => {
  const logout = vi.fn(async () => {})
  const changed = vi.fn()
  window.plugins = { routerAuthStatus: async () => ({ authenticated: true, required: true }), routerLogout: logout } as any
  render(<Provider><RouterAuth onChange={changed} /></Provider>)
  fireEvent.click(await screen.findByRole('button', { name: 'Sign out of 9router' }))
  await screen.findByRole('alertdialog', { name: 'Sign out of 9router?' })
  expect(logout).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
  await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
  expect(changed).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Sign out of 9router' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Sign out' }))
  await screen.findByRole('button', { name: 'Sign in to 9router' })
  expect(logout).toHaveBeenCalledOnce()
  expect(changed).toHaveBeenCalledOnce()
})
it('keeps the confirmation open with a safe error when sign out fails', async () => {
  window.plugins = { routerAuthStatus: async () => ({ authenticated: true, required: true }), routerLogout: async () => { throw new Error('secret') } } as any
  render(<Provider><RouterAuth onChange={() => {}} /></Provider>)
  fireEvent.click(await screen.findByRole('button', { name: 'Sign out of 9router' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Sign out' }))
  expect((await screen.findByRole('alert')).textContent).toContain('Could not sign out')
  expect(screen.queryByText('secret')).toBeNull()
  expect(screen.getByRole('alertdialog')).toBeTruthy()
})
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
