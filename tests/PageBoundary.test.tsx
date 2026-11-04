// @vitest-environment jsdom
import React from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { PageBoundary } from '../src/renderer/src/PageBoundary'
afterEach(() => { cleanup(); vi.restoreAllMocks() })
it('keeps surrounding UI available when an optional page fails to load', () => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  function Broken(): React.ReactNode { throw new Error('Chunk unavailable') }
  render(<><div>Terminal still mounted</div><PageBoundary><Broken /></PageBoundary></>)
  expect(screen.getByText('Terminal still mounted')).toBeTruthy()
  expect(screen.getByRole('alert').textContent).toContain('Could not load this page')
})
it('renders a healthy page normally', () => {
  render(<PageBoundary><div>Library content</div></PageBoundary>)
  expect(screen.getByText('Library content')).toBeTruthy()
})
