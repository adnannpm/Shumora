// @vitest-environment jsdom
import React from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Provider } from '../src/renderer/src/Provider'
import { Diagnostics } from '../src/renderer/src/Diagnostics'
afterEach(cleanup)
it('runs checks only on request and copies the sanitized report', async () => {
  const report = { platform: 'win32', pi: { executable: '<HOME>\\pi-launcher.js', installation: 'Official installer', version: '1.4.0' }, node: { executable: 'C:\\node\\node.exe', version: 'v24.0.0' }, launch: { ok: true, file: 'C:\\node\\node.exe', args: ['<HOME>\\pi-launcher.js'], output: '1.4.0' }, path: ['C:\\node'] }
  window.diagnostics = { run: vi.fn(async () => report) } as any
  const writeText = vi.fn(async () => {})
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
  render(<Provider><Diagnostics /></Provider>)
  expect(window.diagnostics.run).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Run diagnostics' }))
  await screen.findByText('Pi launch check passed')
  expect(screen.getByText('Official installer')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Copy diagnostic report' }))
  await waitFor(() => expect(writeText).toHaveBeenCalledWith(JSON.stringify(report, null, 2)))
  const details = screen.getByText('Report details').closest('details')!
  expect(details.open).toBe(false)
  fireEvent.click(screen.getByText('Report details'))
  expect(details.open).toBe(true)
  expect(screen.getByRole('region', { name: 'Diagnostic report' }).textContent).toContain('<HOME>')
})
it('reports bridge errors and allows retrying', async () => {
  window.diagnostics = { run: vi.fn().mockRejectedValueOnce(new Error('Unavailable')).mockResolvedValueOnce({ platform: 'linux', pi: { installation: 'Unknown', error: 'Pi missing' }, node: {}, launch: { ok: false, args: [], output: 'Pi missing' }, path: [] }) }
  render(<Provider><Diagnostics /></Provider>)
  fireEvent.click(screen.getByRole('button', { name: 'Run diagnostics' }))
  await screen.findByRole('alert')
  fireEvent.click(screen.getByRole('button', { name: 'Run diagnostics' }))
  await screen.findByText('Pi launch check failed')
})
