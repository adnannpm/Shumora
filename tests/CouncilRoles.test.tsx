// @vitest-environment jsdom
import React from 'react'
import { afterEach, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { Provider } from '../src/renderer/src/Provider'
import { CouncilRolesSettings, readCouncilRoles, defaultCouncilRoles } from '../src/renderer/src/CouncilRoles'
const values = new Map<string, string>()
Object.defineProperty(window, 'localStorage', { configurable: true, value: { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) } })
afterEach(() => { cleanup(); values.clear() })
it('adds, renames and deletes persistent roles and rejects duplicate names', async () => {
  const view = render(<Provider><CouncilRolesSettings /></Provider>)
  expect(screen.queryByRole('textbox', { name: 'Role name' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Manage roles' }))
  const input = await screen.findByRole('textbox', { name: 'Role name' })
  fireEvent.change(input, { target: { value: 'Legal' } })
  fireEvent.click(screen.getByRole('button', { name: 'Add role' }))
  expect(readCouncilRoles().some(role => role.name === 'Legal')).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: 'Edit role Legal' }))
  fireEvent.change(input, { target: { value: 'Compliance' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save role' }))
  view.unmount()
  render(<Provider><CouncilRolesSettings /></Provider>)
  fireEvent.click(screen.getByRole('button', { name: 'Manage roles' }))
  expect(await screen.findByRole('button', { name: 'Delete role Compliance' })).toBeTruthy()
  fireEvent.change(screen.getByRole('textbox', { name: 'Role name' }), { target: { value: 'backend' } })
  fireEvent.click(screen.getByRole('button', { name: 'Add role' }))
  expect(screen.getByRole('alert').textContent).toContain('already exists')
  fireEvent.click(screen.getByRole('button', { name: 'Delete role Compliance' }))
  expect(readCouncilRoles().some(role => role.name === 'Compliance')).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
  expect(readCouncilRoles().some(role => role.name === 'Compliance')).toBe(false)
  fireEvent.click(screen.getByRole('button', { name: 'Done' }))
  expect(await screen.findByRole('button', { name: 'Manage roles' })).toBeTruthy()
})
it('preserves an empty role list and falls back on invalid storage', () => {
  values.set('shumora.council-roles', '[]')
  expect(readCouncilRoles()).toEqual([])
  values.set('shumora.council-roles', '{broken')
  expect(readCouncilRoles()).toEqual(defaultCouncilRoles)
})
