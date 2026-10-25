// @vitest-environment jsdom
import React from 'react'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { JSDOM } from 'jsdom'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Provider } from '../src/renderer/src/Provider'
import { ReleaseNotesProvider, useReleaseNotes } from '../src/renderer/src/ReleaseNotes'
import { releaseVersion, releaseNotes } from '../src/renderer/src/release-data'
beforeEach(() => Object.defineProperty(window, 'localStorage', { configurable: true, value: new JSDOM('', { url: 'https://shumora.test' }).window.localStorage }))
afterEach(cleanup)
function OpenNotes() { const { show } = useReleaseNotes(); return <button onClick={show}>Release notes</button> }
function Fixture() { return <Provider><ReleaseNotesProvider><OpenNotes /></ReleaseNotesProvider></Provider> }
it('shows bundled notes once per version and permits reopening them', async () => {
  const view = render(<Fixture />)
  await screen.findByRole('dialog', { name: `What’s new in Shumora ${releaseVersion}` })
  expect(screen.getByTestId('release-notes').textContent).toBe(releaseNotes)
  fireEvent.click(screen.getByRole('button', { name: 'Got it' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(window.localStorage.getItem('shumora.seenRelease')).toBe(releaseVersion)
  view.unmount(); render(<Fixture />)
  expect(screen.queryByRole('dialog')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Release notes' }))
  await screen.findByRole('dialog')
})
it('shows notes again when the stored seen version is different', async () => {
  window.localStorage.setItem('shumora.seenRelease', '0.0.0')
  render(<Fixture />); await screen.findByRole('dialog')
})
