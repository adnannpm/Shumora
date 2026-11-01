// @vitest-environment jsdom
import React from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Provider } from '../src/renderer/src/Provider'
import { Diagnostics } from '../src/renderer/src/Diagnostics'
afterEach(() => { cleanup(); delete window.appClipboard })
it('checks only on request, explains the scope and copies the sanitized report through native clipboard', async () => {
  const report = { platform: 'win32', pi: { executable: '<HOME>\\pi-launcher.js', installation: 'Official installer', version: '1.4.0' }, node: { executable: 'C:\\node\\node.exe', version: 'v24.0.0' }, launch: { ok: true, file: 'C:\\node\\node.exe', args: ['<HOME>\\pi-launcher.js'], output: '1.4.0' }, path: ['C:\\node'] }
  window.diagnostics = { run: vi.fn(async () => report) } as any
  const writeText = vi.fn(async () => {})
  window.appClipboard = { writeText }
  render(<Provider><Diagnostics /></Provider>)
  expect(window.diagnostics.run).not.toHaveBeenCalled()
  expect(screen.queryByRole('button', { name: 'Copy report for support' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Check now' }))
  await screen.findByText('Pi can be started.')
  expect(screen.getByText('AI connections and accounts have not been checked.')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Copy report for support' }))
  await waitFor(() => expect(writeText).toHaveBeenCalledWith(JSON.stringify(report, null, 2)))
  const details = screen.getByText('Technical details').closest('details')!
  expect(details.open).toBe(false)
  fireEvent.click(screen.getByText('Technical details'))
  expect(details.open).toBe(true)
  expect(screen.getByRole('region', { name: 'Diagnostic report' }).textContent).toContain('<HOME>')
})
it('reports bridge errors, allows retrying and guides missing-Pi users to Library', async () => {
  window.diagnostics = { run: vi.fn().mockRejectedValueOnce(new Error('Unavailable')).mockResolvedValueOnce({ platform: 'linux', pi: { installation: 'Unknown', error: 'Pi missing' }, node: {}, launch: { ok: false, args: [], output: 'Pi missing' }, path: [] }) }
  render(<Provider><Diagnostics /></Provider>)
  fireEvent.click(screen.getByRole('button', { name: 'Check now' }))
  await screen.findByRole('alert')
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
  await screen.findByText('Pi was not found.')
  expect(screen.getByText('Open Library → Pi to check its installation. If you just installed Pi, restart Shumora and check again.')).toBeTruthy()
})
it('does not call a found but failing Pi installation missing or suggest deleting it', async () => {
 window.diagnostics = { run: vi.fn(async()=>({platform:'win32',pi:{executable:'<HOME>/pi.cmd',installation:'Unknown' as const,error:'EACCES'},node:{},launch:{ok:false,args:[],output:'EACCES'},path:[]})) }
 render(<Provider><Diagnostics /></Provider>)
 fireEvent.click(screen.getByRole('button',{name:'Check now'}))
 await screen.findByText('Pi was found, but could not be started.')
 expect(screen.queryByText('Pi was not found.')).toBeNull()
})
