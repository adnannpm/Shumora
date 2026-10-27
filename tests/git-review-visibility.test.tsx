// @vitest-environment jsdom
import React from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { Provider } from '../src/renderer/src/Provider'
import { GitReviewButton } from '../src/renderer/src/GitReview'
afterEach(cleanup)
const renderButton = () => render(<Provider><GitReviewButton sessionId="a" visible /></Provider>)
it('shows source control while repository status is loading', () => {
  window.workspace = { gitStatus: () => new Promise(() => {}) } as any
  renderButton()
  expect(screen.getByRole('group', { name: 'Source control' })).toBeTruthy()
})
it('explains when the focused terminal is not in a repository', async () => {
  window.workspace = { gitStatus: vi.fn(async () => ({ isRepo: false, changes: [] })) } as any
  renderButton()
  expect(await screen.findByText('Not a Git repository')).toBeTruthy()
})
it('shows bridge errors rather than silently hiding the feature', async () => {
  window.workspace = { gitStatus: vi.fn(async () => { throw new Error('Backend unavailable') }) } as any
  renderButton()
  expect((await screen.findByRole('alert')).textContent).toContain('Backend unavailable')
})
