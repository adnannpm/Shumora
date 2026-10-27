// @vitest-environment jsdom
import React from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MeetingRoom } from '../src/renderer/src/MeetingRoom'
import type { MeetingSnapshot } from '../src/shared/meetings'
afterEach(() => { cleanup(); delete window.meetings })
const sessions = [
  { id: 'a', name: 'Design', cwd: '/work', status: 'running' as const, generation: 1 },
  { id: 'b', name: 'Engineering', cwd: '/work', status: 'running' as const, generation: 1 },
  { id: 'c', name: 'Old terminal', cwd: '/work', status: 'running' as const, generation: 1 }
]
function setup() {
  let snapshot: MeetingSnapshot = { agents: { a: 'ready', b: 'ready', c: 'disconnected' }, state: { revision: 1, phase: 'setup', agenda: '', participants: [], leader: 'user', messages: [], round: 0 } }
  let listener: (value: MeetingSnapshot) => void = () => {}
  const api = { snapshot: vi.fn(async () => snapshot), start: vi.fn(async () => {}), pause: vi.fn(async () => {}), resume: vi.fn(async () => {}), stop: vi.fn(async () => {}), takeOver: vi.fn(async () => {}), direction: vi.fn(async () => {}), onChange: (fn: typeof listener) => { listener = fn; return () => {} } }
  window.meetings = api
  const update = (patch: Partial<MeetingSnapshot['state']>) => act(() => { snapshot = { ...snapshot, state: { ...snapshot.state, revision: snapshot.state.revision + 1, ...patch } }; listener(snapshot) })
  const view = render(<MeetingRoom sessions={sessions} />)
  return { api, update, view }
}
it('presents Council setup with a topic workspace and a separate member panel', async () => {
  setup()
  expect(screen.getByRole('heading', { name: 'Council', level: 1 })).toBeTruthy()
  expect(screen.getByRole('heading', { name: 'New discussion' })).toBeTruthy()
  expect(screen.queryByText('A space for better decisions')).toBeNull()
  expect(screen.queryByLabelText('Discussion flow')).toBeNull()
  expect(document.querySelector('.council-symbol, .council-avatar, .council-eyebrow')).toBeNull()
  expect(screen.getByRole('complementary', { name: 'Council members' })).toBeTruthy()
  await waitFor(() => expect((screen.getByLabelText('Invite Design') as HTMLInputElement).disabled).toBe(false))
  expect((screen.getByRole('button', { name: /Start Council/ }) as HTMLButtonElement).disabled).toBe(true)
  fireEvent.click(screen.getByLabelText('Invite Design'))
  expect(screen.getByText('1/8')).toBeTruthy()
})
it('shows the live member roles, current speaker and distinct summary', async () => {
  const { update } = setup()
  await screen.findByLabelText('Invite Design')
  update({ phase: 'running', agenda: 'Launch', round: 2, speaker: 'a', participants: [{ id: 'a', name: 'Design', role: 'Visual direction' }], messages: [{ author: 'Design', text: 'Ship a small launch.', kind: 'summary' }] })
  expect(screen.queryByRole('complementary', { name: 'Council members' })).toBeNull()
  fireEvent.click(screen.getByText('1 members'))
  const members = screen.getByRole('group', { name: 'Council members' })
  expect(members.textContent).toContain('Visual direction')
  expect(members.textContent).toContain('Speaking')
  expect(screen.getByRole('heading', { name: 'Council summary' })).toBeTruthy()
  expect(screen.getByText('Round 2 of 2')).toBeTruthy()
})
it('groups consecutive agent messages and identifies user messages independently of their display name', async () => {
  const { update } = setup()
  await screen.findByLabelText('Invite Design')
  update({ phase: 'running', round: 1, speaker: 'a', participants: [{ id: 'a', name: 'Design', role: '' }], messages: [
    { author: 'Design', text: 'First idea', kind: 'response' },
    { author: 'Design', text: 'Another idea', kind: 'response' },
    { author: 'Kamu', text: 'Prioritize accessibility', kind: 'direction' },
    { author: 'Design', text: 'Agreed', kind: 'response' },
    { author: 'Design', text: 'Final decision', kind: 'summary' }
  ] })
  const messages = screen.getAllByRole('article')
  expect(messages[0].querySelector('.council-message-author')?.textContent).toBe('Design')
  expect(messages[1].querySelector('.council-message-author')).toBeNull()
  expect(messages[1].classList.contains('is-grouped')).toBe(true)
  expect(messages[2].classList.contains('meeting-direction')).toBe(true)
  expect(messages[3].querySelector('.council-message-author')?.textContent).toBe('Design')
  expect(messages[4].querySelector('.council-message-author')?.textContent).toBe('Design')
  expect(screen.getByRole('status').textContent).toBe('Design is typing…')
  update({ phase: 'paused' })
  expect(screen.queryByText('Design is typing…')).toBeNull()
})
it('starts an automatic meeting with one action and renders real replies without manual relay controls', async () => {
  const { api, update } = setup()
  await screen.findByLabelText('Invite Design')
  fireEvent.change(screen.getByLabelText('Discussion topic'), { target: { value: 'Launch plan' } })
  fireEvent.click(screen.getByLabelText('Invite Design'))
  fireEvent.click(screen.getByLabelText('Invite Engineering'))
  fireEvent.click(screen.getByRole('button', { name: 'Start Council' }))
  await waitFor(() => expect(api.start).toHaveBeenCalledWith(expect.objectContaining({ agenda: 'Launch plan', leader: 'user', participants: expect.arrayContaining([expect.objectContaining({ id: 'a' }), expect.objectContaining({ id: 'b' })]) })))
  update({ phase: 'running', agenda: 'Launch plan', speaker: 'a', round: 1, participants: sessions.slice(0, 2).map(s => ({ id: s.id, name: s.name, role: '' })), messages: [{ author: 'Design', text: 'A minimal identity fits our launch.', kind: 'response' }] })
  expect(screen.getByText('A minimal identity fits our launch.')).toBeTruthy()
  expect(screen.queryByLabelText('Participant response')).toBeNull()
  expect(screen.queryByRole('button', { name: 'Publish response' })).toBeNull()
  expect(screen.queryByLabelText('Next speaker')).toBeNull()
})
it('explains unconnected terminals without restarting them and exposes pause, stop and takeover', async () => {
  const { api, update } = setup()
  await screen.findByLabelText('Invite Old terminal')
  expect((screen.getByLabelText('Invite Old terminal') as HTMLInputElement).disabled).toBe(true)
  expect(screen.getByText(/New Pi terminals connect automatically/)).toBeTruthy()
  update({ phase: 'running', leader: 'b' })
  fireEvent.click(screen.getByRole('button', { name: 'Pause Council' }))
  await waitFor(() => expect((screen.getByRole('button', { name: 'Take over' }) as HTMLButtonElement).disabled).toBe(false))
  expect(api.pause).toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Take over' }))
  await waitFor(() => expect((screen.getByRole('button', { name: 'Stop Council' }) as HTMLButtonElement).disabled).toBe(false))
  expect(api.takeOver).toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Stop Council' }))
  expect(api.stop).toHaveBeenCalled()
  await waitFor(() => expect((screen.getByRole('button', { name: 'Stop Council' }) as HTMLButtonElement).disabled).toBe(false))
  update({ phase: 'paused', error: 'Provider failed' })
  expect(screen.getByRole('alert').textContent).toContain('Provider failed')
  fireEvent.click(screen.getByRole('button', { name: 'Resume Council' }))
  expect(api.resume).toHaveBeenCalled()
})
it('renders Markdown safely and offers a prominent user turn with send and skip actions', async () => {
  const { api, update } = setup()
  await screen.findByLabelText('Invite Design')
  update({ phase: 'paused', awaitingUser: true, round: 1, messages: [{ author: 'Design', text: '## Proposal\n\n**Launch** with:\n\n- Simple visuals\n- `MVP` first\n\n<script>alert(1)</script>\n\n![remote](https://example.com/tracker.png)', kind: 'response' }] })
  expect(screen.getByRole('heading', { name: 'Proposal' })).toBeTruthy()
  expect(screen.getByText('Launch').tagName).toBe('STRONG')
  expect(screen.getAllByRole('listitem')).toHaveLength(2)
  expect(document.querySelector('.meeting-message script')).toBeNull()
  expect(document.querySelector('.meeting-message img')).toBeNull()
  expect(screen.getByRole('heading', { name: 'Your turn' })).toBeTruthy()
  fireEvent.change(screen.getByLabelText('Your message'), { target: { value: 'What about accessibility?' } })
  fireEvent.click(screen.getByRole('button', { name: 'Send & continue' }))
  await waitFor(() => expect(api.direction).toHaveBeenCalledWith('What about accessibility?'))
  await waitFor(() => expect((screen.getByRole('button', { name: 'Continue without a message' }) as HTMLButtonElement).disabled).toBe(false))
  fireEvent.click(screen.getByRole('button', { name: 'Continue without a message' }))
  expect(api.resume).toHaveBeenCalled()
})
it('keeps the reading position on new replies and offers an explicit jump to new messages', async () => {
  const { update } = setup()
  await screen.findByLabelText('Invite Design')
  update({ phase: 'running', messages: [{ author: 'Design', text: 'First reply', kind: 'response' }] })
  const log = screen.getByRole('log')
  Object.defineProperties(log, { scrollHeight: { configurable: true, value: 1000 }, clientHeight: { configurable: true, value: 300 }, scrollTop: { configurable: true, writable: true, value: 120 } })
  fireEvent.scroll(log)
  update({ messages: [{ author: 'Design', text: 'First reply', kind: 'response' }, { author: 'Engineering', text: 'New reply', kind: 'response' }] })
  expect(log.scrollTop).toBe(120)
  fireEvent.click(screen.getByRole('button', { name: '1 new messages ↓' }))
  expect(log.scrollTop).toBe(log.scrollHeight)
  expect(screen.queryByRole('button', { name: /new messages/ })).toBeNull()
  log.scrollTop = 100
  update({ messages: [{ author: 'Design', text: 'First reply', kind: 'response' }, { author: 'Engineering', text: 'New reply', kind: 'response' }, { author: 'Design', text: 'Another reply', kind: 'response' }] })
  expect(screen.getByRole('button', { name: '1 new messages ↓' })).toBeTruthy()
  log.scrollTop = 700
  fireEvent.scroll(log)
  expect(screen.queryByRole('button', { name: /new messages/ })).toBeNull()
})
it('shows missing bridge guidance instead of offering fake automated meetings', () => {
  render(<MeetingRoom sessions={sessions} />)
  expect(screen.getByText('Restart Shumora to enable Council.')).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Start Council' })).toBeNull()
})
