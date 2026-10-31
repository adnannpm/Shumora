// @vitest-environment jsdom
import React from 'react'
import { afterEach, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Provider } from '../src/renderer/src/Provider'
import { CouncilRolesSettings, readCouncilRoles, defaultCouncilRoles } from '../src/renderer/src/CouncilRoles'
const values = new Map<string, string>()
Object.defineProperty(window, 'localStorage', { configurable: true, value: { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) } })
afterEach(() => { cleanup(); values.clear() })
async function openManager() {
  render(<Provider><CouncilRolesSettings /></Provider>)
  fireEvent.click(screen.getByRole('button', { name: 'Manage roles' }))
  return screen.findByRole('textbox', { name: 'Role name' })
}
it('adds a role and restores it when the manager is remounted', async () => {
  const input = await openManager()
  fireEvent.change(input, { target: { value: 'Legal' } })
  fireEvent.click(screen.getByRole('button', { name: 'Add role' }))
  expect(readCouncilRoles().some(role => role.name === 'Legal')).toBe(true)
  cleanup()
  await openManager()
  expect(screen.getByRole('button', { name: 'Delete role Legal' })).toBeTruthy()
})
it('renames an existing role persistently', async () => {
  values.set('shumora.council-roles', JSON.stringify([{ id: 'legal', name: 'Legal' }]))
  const input = await openManager()
  fireEvent.click(screen.getByRole('button', { name: 'Edit role Legal' }))
  fireEvent.change(input, { target: { value: 'Compliance' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save role' }))
  expect(readCouncilRoles()).toEqual([{ id: 'legal', name: 'Compliance' }])
  expect(screen.getByRole('button', { name: 'Delete role Compliance' })).toBeTruthy()
})
it('rejects duplicate role names case-insensitively without changing storage', async () => {
  const input = await openManager()
  fireEvent.change(input, { target: { value: 'backend' } })
  fireEvent.click(screen.getByRole('button', { name: 'Add role' }))
  expect(screen.getByRole('alert').textContent).toContain('already exists')
  expect(readCouncilRoles()).toEqual(defaultCouncilRoles)
})
it('deletes a role only after confirmation', async () => {
  values.set('shumora.council-roles', JSON.stringify([{ id: 'legal', name: 'Legal' }]))
  await openManager()
  fireEvent.click(screen.getByRole('button', { name: 'Delete role Legal' }))
  expect(readCouncilRoles()).toEqual([{ id: 'legal', name: 'Legal' }])
  fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
  expect(readCouncilRoles()).toEqual([])
})
it('closes the manager with Done', async () => {
  render(<Provider><CouncilRolesSettings /></Provider>)
  expect(screen.queryByRole('textbox', { name: 'Role name' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Manage roles' }))
  await screen.findByRole('textbox', { name: 'Role name' })
  fireEvent.click(screen.getByRole('button', { name: 'Done' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(screen.getByRole('button', { name: 'Manage roles' })).toBeTruthy()
})
it('preserves an empty role list and falls back on invalid storage', () => {
  values.set('shumora.council-roles', '[]')
  expect(readCouncilRoles()).toEqual([])
  values.set('shumora.council-roles', '{broken')
  expect(readCouncilRoles()).toEqual(defaultCouncilRoles)
})
