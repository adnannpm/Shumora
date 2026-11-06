// @vitest-environment jsdom
import React from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { Session, WorkspaceAPI } from '../src/shared/types'
vi.mock('../src/renderer/src/TerminalPane', () => ({ TerminalPane: ({ session, visible, focused, autoFocusBlocked, onFocus }: { session: Session; visible: boolean; focused: boolean; autoFocusBlocked: boolean; onFocus: () => void }) => <div data-testid={session.id} data-visible={visible} data-focused={focused && !autoFocusBlocked} onClick={onFocus}>{session.error}</div> }))
import App from '../src/renderer/src/App'
import { Provider } from '../src/renderer/src/Provider'
beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
  vi.stubGlobal('localStorage', { getItem: () => 'true', setItem() {} })
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })
function setup(count = 1, approved = true) {
  let sessions: Session[] = Array.from({ length: count }, (_, i) => ({
    id: String(i + 1),
    name: `Pi ${i + 1}`,
    cwd: '/tmp',
    agent: 'pi',
    status: 'running',
    generation: 1
  }))
  let counter = count
  const api: WorkspaceAPI = {
    gitStatus: vi.fn(async () => ({ isRepo: false, changes: [] })),
    gitDiff: vi.fn(),
    gitStage: vi.fn(),
    gitUnstage: vi.fn(),
    gitStageAll: vi.fn(),
    gitUnstageAll: vi.fn(),
    gitDiscard: vi.fn(),
    gitCommit: vi.fn(),
    gitPush: vi.fn(),
    gitPushInfo: vi.fn(async () => ({ branch: 'main', hasUpstream: true, ahead: 0, behind: 0, commits: [] })),
    gitCommitModels: vi.fn(),
    gitGenerateMessage: vi.fn(),
    gitBranches: vi.fn(),
    gitSwitch: vi.fn(),
    list: vi.fn(async () => sessions),
    create: vi.fn(async (cwd = '/tmp', agent: Session['agent'] = 'pi') => {
      const n = ++counter
      const s: Session = {
        id: String(n),
        name: `${agent === 'pi' ? 'Pi' : 'OpenCode'} ${n}`,
        cwd,
        agent,
        status: 'running',
        generation: 1
      }
      sessions = [...sessions, s]
      return s
    }),
    rename: vi.fn(async (id, name) => {
      const session = { ...sessions.find(s => s.id === id)!, name }
      sessions = sessions.map(s => (s.id === id ? session : s))
      return session
    }),
    close: vi.fn(async () => approved),
    folder: async () => '/tmp',
    chooseFolder: vi.fn(async () => '/project'),
    onEvent: vi.fn(() => () => {}),
    snapshot: vi.fn(),
    input: vi.fn(),
    resize: vi.fn(),
    stop: vi.fn(),
    restart: vi.fn()
  }
  window.terminalAgent = {
    status: vi.fn(async () => ({ active: 'opencode' as const, canChange: true, installed: { pi: true, opencode: true } })),
    select: vi.fn()
  }
  window.piPlugin = { status: async () => ({ installed: true }) } as any
  window.plugins = { status: async () => ({ id: '9router', installed: true }) } as any
  window.workspace = api
  render(
    <Provider>
      <App />
    </Provider>
  )
  return api
}
it('checks on startup and opens About & Updates from the in-app update notification without stopping sessions', async () => {
  let listener = (_: import('../src/shared/updates').UpdateState) => {}
  window.updates = {
    status: async () => ({ status: 'idle', currentVersion: '1.0.0' }),
    onState: cb => { listener = cb; return () => {} },
    check: vi.fn(async () => { listener({ status: 'available', currentVersion: '1.0.0', version: '1.1.0' }) }),
    download: vi.fn(async () => {}), install: vi.fn(async () => {})
  }
  const api = setup()
  try {
    const viewUpdate = await screen.findByRole('button', { name: 'View update' })
    expect(screen.getByRole('status').textContent).toContain('1.1.0')
    expect(window.updates.check).toHaveBeenCalledOnce()
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    fireEvent.click(viewUpdate)
    expect(await screen.findByRole('heading', { name: 'About & Updates' })).toBeTruthy()
    expect(await screen.findByRole('button', { name: 'Check for updates' })).toBeTruthy()
    expect(window.updates.download).not.toHaveBeenCalled()
    expect(window.updates.install).not.toHaveBeenCalled()
    expect(api.stop).not.toHaveBeenCalled()
  } finally { delete (window as any).updates }
})

it('creates sessions directly without a setup modal when Pi is installed', async () => {
  const api = setup()
  await screen.findByRole('tab', { name: 'Pi 1' })
  fireEvent.click(screen.getByRole('button', { name: 'New session in group 1' }))
  await screen.findByRole('tab', { name: 'Pi 2' })
  expect(api.create).toHaveBeenCalledTimes(1)
  expect(api.create).toHaveBeenCalledWith('/tmp', 'pi')
  expect(window.terminalAgent!.select).not.toHaveBeenCalled()
  expect(screen.queryByRole('heading', { name: 'Set up your Terminals' })).toBeNull()
})

function flushAnimationFrames() {
  return act(async () => {
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
  })
}

async function selectMenuItem(item: HTMLElement) {
  fireEvent.pointerDown(item, { pointerType: 'mouse', button: 0 })
  await waitFor(() => expect(item.hasAttribute('data-highlighted')).toBe(true))
  fireEvent.pointerUp(item, { pointerType: 'mouse', button: 0 })
  fireEvent.click(item)
}

it('opens only Pi and OpenCode and creates in the clicked group folder without changing Settings', async () => {
  const api = setup()
  await screen.findByRole('tab', { name: 'Pi 1' })
  fireEvent.click(screen.getByRole('button', { name: 'New terminal in folder…' }))
  await screen.findByRole('tab', { name: 'Pi 2' })
  fireEvent.click(screen.getByRole('button', { name: 'Split right' }))
  fireEvent.click(screen.getByRole('tab', { name: 'Pi 1' }))

  const trigger = screen.getByRole('button', { name: 'New session options in group 2' })
  fireEvent.click(trigger)
  const code = await screen.findByRole('menuitem', { name: 'OpenCode' })
  await waitFor(() => expect(code.hasAttribute('data-disabled')).toBe(false))
  expect(screen.getAllByRole('menuitem').map(item => item.textContent)).toEqual(['Pi', 'OpenCode'])
  await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('menu')))

  await selectMenuItem(code)
  await waitFor(() => expect(api.create).toHaveBeenLastCalledWith('/project', 'opencode'))

  const tab = await screen.findByRole('tab', { name: 'OpenCode 3' })
  expect(tab.closest('[role="tablist"]')).toBe(screen.getByRole('tablist', { name: 'Session group 2' }))

  // The clicked group's active tab, not global focus or Settings, decides the program.
  fireEvent.click(screen.getByRole('tab', { name: 'Pi 1' }))
  fireEvent.click(screen.getByRole('button', { name: 'New session in group 2' }))
  const nextCode = await screen.findByRole('tab', { name: 'OpenCode 4' })
  expect(api.create).toHaveBeenLastCalledWith('/project', 'opencode')
  expect(nextCode.closest('[role="tablist"]')).toBe(screen.getByRole('tablist', { name: 'Session group 2' }))

  fireEvent.click(screen.getByRole('tab', { name: 'Pi 2' }))
  fireEvent.click(screen.getByRole('button', { name: 'New session in group 2' }))
  await screen.findByRole('tab', { name: 'Pi 5' })
  expect(api.create).toHaveBeenLastCalledWith('/project', 'pi')
  expect(window.terminalAgent!.select).not.toHaveBeenCalled()
  expect(api.stop).not.toHaveBeenCalled()
  expect(api.restart).not.toHaveBeenCalled()
})

it('switches directly between group launchers without a late dismissal closing the new menu', async () => {
  setup(2)
  await screen.findByRole('tab', { name: 'Pi 2' })
  fireEvent.click(screen.getByRole('button', { name: 'Split right' }))

  const first = screen.getByRole('button', { name: 'New session options in group 1' })
  const second = screen.getByRole('button', { name: 'New session options in group 2' })

  fireEvent.click(first)
  await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('menu')))
  await flushAnimationFrames()

  fireEvent.pointerDown(second, { button: 0 })
  fireEvent.pointerUp(second, { button: 0 })
  fireEvent.click(second)
  await flushAnimationFrames()

  await waitFor(() => expect(second.getAttribute('aria-expanded')).toBe('true'))
  await waitFor(() => expect(first.getAttribute('aria-expanded')).toBe('false'))
  expect(screen.getByRole('menu')).toBeTruthy()
})
it('refreshes installation status on opening and supports keyboard dismissal with focus return', async () => {
  setup()
  await screen.findByRole('tab', { name: 'Pi 1' })
  const status = vi.mocked(window.terminalAgent!.status)
  status.mockResolvedValue({ active: 'pi', canChange: true, installed: { pi: true, opencode: false } })
  const trigger = screen.getByRole('button', { name: 'New session options in group 1' })
  fireEvent.click(trigger)
  const code = await screen.findByRole('menuitem', { name: 'OpenCode' })
  await waitFor(() => expect(status).toHaveBeenCalledTimes(2))
  await waitFor(() => expect(code.getAttribute('data-disabled')).not.toBeNull())
  expect(code.getAttribute('data-disabled')).not.toBeNull()
  expect(screen.getByTestId('1').getAttribute('data-focused')).toBe('false')
  fireEvent.keyDown(code, { key: 'Escape' })
  await waitFor(() => expect(screen.queryByRole('menu')).toBeNull())
  await waitFor(() => expect(document.activeElement).toBe(trigger))
  status.mockResolvedValue({ active: 'pi', canChange: true, installed: { pi: true, opencode: true } })
  fireEvent.keyDown(trigger, { key: 'ArrowDown' })
  const enabledCode = await screen.findByRole('menuitem', { name: 'OpenCode' })
  await waitFor(() => expect(enabledCode.hasAttribute('data-disabled')).toBe(false))
  expect(status).toHaveBeenCalledTimes(3)
  fireEvent.keyDown(enabledCode, { key: 'Escape' })
})
it('keeps the last installation result clickable during a slow menu refresh', async () => {
  const api = setup()
  await screen.findByRole('tab', { name: 'Pi 1' })
  const status = vi.mocked(window.terminalAgent!.status)
  await waitFor(() => expect(status).toHaveBeenCalledTimes(1))
  let finish!: (value: Awaited<ReturnType<typeof status>>) => void
  status.mockReturnValueOnce(new Promise(resolve => { finish = resolve }))
  const trigger = screen.getByRole('button', { name: 'New session options in group 1' })
  fireEvent.click(trigger)
  const pi = await screen.findByRole('menuitem', { name: 'Pi' })
  expect(pi.hasAttribute('data-disabled')).toBe(false)
  expect(screen.getByRole('menuitem', { name: 'OpenCode' }).hasAttribute('data-disabled')).toBe(false)
  await act(async () => { finish({ active: 'pi', canChange: true, installed: { pi: true, opencode: false } }) })
  await waitFor(() => expect(screen.getByRole('menuitem', { name: 'OpenCode' }).hasAttribute('data-disabled')).toBe(true))
  fireEvent.pointerDown(pi, { button: 0 })
  await waitFor(() => expect(pi.hasAttribute('data-highlighted')).toBe(true))
  fireEvent.click(pi)
  await screen.findByRole('tab', { name: 'Pi 2' })
  expect(api.create).toHaveBeenLastCalledWith('/tmp', 'pi')
})
it('focuses an Explorer-opened terminal and switches back from Settings', async () => {
  const api = setup()
  await screen.findByRole('tab', { name: 'Pi 1' })
  fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
  const listener = vi.mocked(api.onEvent).mock.calls[0][0]
  act(() => listener({ type: 'opened', session: { id: 'explorer', name: 'Pi 2', cwd: 'C:\\Projects', agent: 'pi', status: 'running', generation: 1 } }))
  expect((await screen.findByRole('tab', { name: 'Pi 2' })).getAttribute('aria-selected')).toBe('true')
  expect(screen.getByTestId('explorer').getAttribute('data-visible')).toBe('true')
  expect(api.create).not.toHaveBeenCalled()
})
it('shows activity and an unread badge for a hidden agent, clearing it when selected', async () => {
  const api = setup(2)
  await screen.findByRole('tab', { name: 'Pi 2' })
  fireEvent.click(screen.getByRole('tab', { name: 'Pi 1' }))
  const listener = vi.mocked(api.onEvent).mock.calls[0][0]
  act(() => listener({ type: 'activity', id: '2', generation: 1, activity: 'working' }))
  expect(screen.getByRole('tab', { name: 'Pi 2' }).textContent).toContain('Working')
  act(() => listener({ type: 'activity', id: '2', generation: 1, activity: 'done' }))
  expect(screen.getByLabelText('Unread agent update')).toBeTruthy()
  fireEvent.click(screen.getByRole('tab', { name: 'Pi 2' }))
  await waitFor(() => expect(screen.queryByLabelText('Unread agent update')).toBeNull())
})
it('keeps full names available on hover without a terminal dropdown', async () => {
  setup(20)
  const tab = await screen.findByRole('tab', { name: 'Pi 20' })
  expect(tab.title).toBe('Pi 20')
  expect(screen.queryByRole('button', { name: 'List terminals in group 1' })).toBeNull()
})
it('slides tabs horizontally without browser dragging or restarting Pi', async () => {
  vi.stubGlobal('PointerEvent', MouseEvent)
  const api = setup(3); await screen.findByRole('tab', { name: 'Pi 3' })
  const tabs = screen.getAllByRole('tab').map(tab => tab.parentElement!)
  tabs.forEach((tab, i) => { tab.getBoundingClientRect = () => ({ left: i * 100, right: (i + 1) * 100, width: 100 } as DOMRect); tab.setPointerCapture = vi.fn() })
  screen.getByRole('tablist', { name: 'Session group 1' }).getBoundingClientRect = () => ({ left: 0, right: 300, width: 300 } as DOMRect)
  expect(tabs[2].getAttribute('draggable')).toBeNull()
  fireEvent.pointerDown(tabs[2], { clientX: 250, button: 0 })
  fireEvent.pointerMove(tabs[2], { clientX: 20, clientY: 500 })
  fireEvent.pointerUp(tabs[2], { clientX: 20 })
  fireEvent.click(screen.getByRole('tab', { name: 'Pi 3' }))
  expect(screen.queryByRole('menu')).toBeNull()
  expect(screen.getAllByRole('tab').map(tab => tab.textContent)).toEqual(['Pi 3', 'Pi 1', 'Pi 2'])
  expect(api.create).not.toHaveBeenCalled(); expect(api.stop).not.toHaveBeenCalled(); expect(api.restart).not.toHaveBeenCalled()
})
it('does not capture normal clicks and releases capture after sliding before selecting another tab', async () => {
  vi.stubGlobal('PointerEvent', MouseEvent)
  setup(2); await screen.findByRole('tab', { name: 'Pi 2' })
  const first = screen.getByRole('tab', { name: 'Pi 1' }).parentElement!
  const capture = vi.fn(), release = vi.fn()
  first.setPointerCapture = capture; first.releasePointerCapture = release; first.hasPointerCapture = () => true
  fireEvent.pointerDown(first, { clientX: 50, button: 0 })
  expect(capture).not.toHaveBeenCalled()
  fireEvent.pointerUp(first, { clientX: 50 })
  expect(screen.getByRole('tab', { name: 'Pi 1' }).getAttribute('aria-selected')).toBe('true')
  fireEvent.pointerDown(first, { clientX: 50, button: 0 })
  fireEvent.pointerMove(first, { clientX: 70, buttons: 1 })
  fireEvent.pointerUp(first, { clientX: 70 })
  expect(release).toHaveBeenCalled()
  fireEvent.click(screen.getByRole('tab', { name: 'Pi 2' }))
  expect(screen.getByRole('tab', { name: 'Pi 2' }).getAttribute('aria-selected')).toBe('true')
})
it('shows startup as a tab with workspace navigation and creates in the active group', async () => {
  const api = setup(); await screen.findByRole('tab', { name: 'Pi 1' })
  expect(screen.getByRole('complementary', { name: 'Main sidebar' })).toBeTruthy()
  const manage = screen.getByRole('group', { name: 'Manage' })
  expect(manage.querySelector('[aria-label="Library"]')).toBeTruthy()
  expect(manage.querySelector('[aria-label="Settings"]')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Terminals' }).getAttribute('aria-current')).toBe('page')
  expect(api.create).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'New session in group 1' }))
  await screen.findByRole('tab', { name: 'Pi 2' })
  expect(screen.getByTestId('1').getAttribute('data-visible')).toBe('false')
  expect(screen.getByTestId('2').getAttribute('data-visible')).toBe('true')
})
it('opens settings and collapses navigation without stopping or recreating sessions', async () => {
  const api = setup(); await screen.findByRole('tab', { name: 'Pi 1' })
  fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
  expect(screen.getByRole('heading', { name: 'Settings' })).toBeTruthy()
  expect(screen.queryByRole('tab', { name: 'Pi 1' })).toBeNull()
  expect(screen.getByTestId('1')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Collapse sidebar' }))
  expect(screen.getByRole('button', { name: 'Expand sidebar' }).getAttribute('aria-expanded')).toBe('false')
  fireEvent.click(screen.getByRole('button', { name: 'Terminals' }))
  expect(screen.getByRole('tab', { name: 'Pi 1' })).toBeTruthy()
  expect(api.create).not.toHaveBeenCalled(); expect(api.stop).not.toHaveBeenCalled()
})
it('opens 9router and Library without recreating or stopping terminal sessions', async () => {
  const api = setup(); await screen.findByRole('tab', { name: 'Pi 1' })
  await screen.findByRole('button', { name: '9router' })
  for (const name of ['9router', 'Library']) {
    fireEvent.click(screen.getByRole('button', { name }))
    expect(await screen.findByRole('heading', { name, level: 1 })).toBeTruthy()
    expect(screen.getByRole('button', { name }).getAttribute('aria-current')).toBe('page')
    expect(screen.queryByRole('tab', { name: 'Pi 1' })).toBeNull()
    expect(screen.getByTestId('1')).toBeTruthy()
  }
  fireEvent.click(screen.getByRole('button', { name: 'Terminals' }))
  expect(screen.getByRole('tab', { name: 'Pi 1' })).toBeTruthy()
  expect(api.create).not.toHaveBeenCalled(); expect(api.stop).not.toHaveBeenCalled()
})
it('honors close cancellation and leaves an empty state after closing the last tab', async () => {
  const api = setup(); await screen.findByRole('tab', { name: 'Pi 1' })
  fireEvent.click(screen.getByRole('button', { name: 'Close Pi 1' }))
  await screen.findByRole('alertdialog', { name: 'Close Pi 1?' })
  expect(api.close).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
  await screen.findByRole('tab', { name: 'Pi 1' })
  fireEvent.click(screen.getByRole('button', { name: 'Close Pi 1' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Stop and close' }))
  await screen.findByText('No open sessions')
  expect(api.create).not.toHaveBeenCalled()
})
it('moves the active tab into a split, supports both orientations and keyboard resizing', async () => {
  const api = setup(3); await screen.findByRole('tab', { name: 'Pi 1' })
  fireEvent.click(screen.getByRole('tab', { name: 'Pi 2' }))
  fireEvent.click(screen.getByRole('button', { name: 'Split right' }))
  expect(screen.getAllByRole('tablist')).toHaveLength(2)
  expect(screen.getByTestId('2').getAttribute('data-visible')).toBe('true')
  expect(api.create).not.toHaveBeenCalled(); expect(api.stop).not.toHaveBeenCalled()
  const divider = screen.getByRole('separator')
  fireEvent.keyDown(divider, { key: 'ArrowRight' }); expect(divider.getAttribute('aria-valuenow')).toBe('55')
  fireEvent.click(screen.getByRole('tab', { name: 'Pi 1' }))
  fireEvent.click(screen.getByRole('button', { name: 'Split down' }))
  expect(screen.getAllByRole('separator').map(separator => separator.getAttribute('aria-orientation'))).toEqual(['vertical', 'horizontal'])
  fireEvent.click(screen.getByRole('button', { name: 'Merge groups' }))
  expect(screen.getAllByRole('tablist')).toHaveLength(1)
})
it('collapses a group after its last tab closes without closing the remaining process', async () => {
  const api = setup(2); await screen.findByRole('tab', { name: 'Pi 1' })
  fireEvent.click(screen.getByRole('button', { name: 'Split right' }))
  fireEvent.click(screen.getByRole('button', { name: 'Close Pi 1' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Stop and close' }))
  await waitFor(() => expect(screen.getAllByRole('tablist')).toHaveLength(1))
  expect(screen.getByRole('tab', { name: 'Pi 2' })).toBeTruthy()
  expect(api.close).toHaveBeenCalledWith('1'); expect(api.stop).not.toHaveBeenCalled()
})
it('explicitly creates a split partner when only one tab exists', async () => {
  const api = setup(); await screen.findByRole('tab', { name: 'Pi 1' })
  fireEvent.click(screen.getByRole('button', { name: 'New session in split right' }))
  await screen.findByRole('tab', { name: 'Pi 2' })
  expect(api.create).toHaveBeenCalledTimes(1)
  expect(screen.getAllByRole('tablist')).toHaveLength(2)
  fireEvent.click(screen.getByRole('button', { name: 'New terminal in folder…' }))
  await screen.findByRole('tab', { name: 'Pi 3' })
  expect(api.create).toHaveBeenLastCalledWith('/project')
})
it('opens only rename and duplicate on right click and renames the selected tab', async () => {
  const api = setup(2)
  fireEvent.contextMenu(await screen.findByRole('tab', { name: 'Pi 1' }))
  expect(screen.getByRole('tab', { name: 'Pi 1' }).getAttribute('aria-selected')).toBe('true')
  expect(screen.getAllByRole('menuitem').map(item => item.textContent)).toEqual(['Rename', 'Duplicate'])
  fireEvent.click(screen.getByRole('menuitem', { name: 'Rename' }))
  expect(screen.queryByRole('menu')).toBeNull()
  const input = screen.getByRole('textbox', { name: 'Rename terminal' })
  fireEvent.change(input, { target: { value: 'Backend' } })
  fireEvent.keyDown(input, { key: 'Enter' })
  await screen.findByRole('tab', { name: 'Backend' })
  expect(api.rename).toHaveBeenCalledWith('1', 'Backend')
  expect(api.restart).not.toHaveBeenCalled()
})
it('duplicates into the source group and folder without copying or restarting its process', async () => {
  const api = setup()
  await screen.findByRole('tab', { name: 'Pi 1' })
  fireEvent.click(screen.getByRole('button', { name: 'New terminal in folder…' }))
  await screen.findByRole('tab', { name: 'Pi 2' })
  fireEvent.click(screen.getByRole('button', { name: 'Split right' }))
  fireEvent.contextMenu(screen.getByRole('tab', { name: 'Pi 2' }))
  fireEvent.click(screen.getByRole('menuitem', { name: 'Duplicate' }))
  const duplicate = await screen.findByRole('tab', { name: 'Pi 3' })
  expect(api.create).toHaveBeenLastCalledWith('/project')
  expect(duplicate.closest('[role="tablist"]')).toBe(screen.getByRole('tab', { name: 'Pi 2' }).closest('[role="tablist"]'))
  expect(duplicate.getAttribute('aria-selected')).toBe('true')
  expect(screen.queryByRole('menu')).toBeNull()
  expect(api.restart).not.toHaveBeenCalled(); expect(api.stop).not.toHaveBeenCalled()
})
it('dismisses the tab menu outside and with Escape, supports keyboard navigation and ignores left click', async () => {
  setup()
  const tab = await screen.findByRole('tab', { name: 'Pi 1' })
  fireEvent.click(tab)
  expect(screen.queryByRole('menu')).toBeNull()
  fireEvent.contextMenu(tab)
  expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Rename' }))
  fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' })
  expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Duplicate' }))
  fireEvent.keyDown(document.activeElement!, { key: 'Escape' })
  expect(screen.queryByRole('menu')).toBeNull()
  expect(document.activeElement).toBe(tab)
  fireEvent.contextMenu(tab)
  fireEvent.pointerDown(document.body)
  expect(screen.queryByRole('menu')).toBeNull()
  fireEvent.contextMenu(tab)
  fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
  expect(screen.queryByRole('menu')).toBeNull()
})
it('shows a text-free spinner immediately while creating a session', async () => {
  const api = setup()
  await screen.findByRole('tab', { name: 'Pi 1' })
  let complete!: (session: Session) => void
  vi.mocked(api.create).mockImplementationOnce(() => new Promise(resolve => { complete = resolve }))
  fireEvent.click(screen.getByRole('button', { name: 'New session in group 1' }))
  await waitFor(() => expect(screen.getByLabelText('Loading terminal', { selector: '[role="progressbar"]', exact: true }).textContent).toBe(''))
  await act(async () => complete({ id: 'new', name: 'New terminal', cwd: '/tmp', agent: 'pi', status: 'running', generation: 1 }))
  await screen.findByRole('tab', { name: 'New terminal' })
  expect(screen.queryByRole('progressbar')).toBeNull()
})
it('suspends terminal autofocus while the context menu or rename editor is open', async () => {
  setup(2)
  fireEvent.contextMenu(await screen.findByRole('tab', { name: 'Pi 2' }))
  expect(screen.getByTestId('2').getAttribute('data-focused')).toBe('false')
  fireEvent.click(screen.getByRole('menuitem', { name: 'Rename' }))
  expect(screen.getByTestId('2').getAttribute('data-focused')).toBe('false')
  fireEvent.keyDown(screen.getByRole('textbox', { name: 'Rename terminal' }), { key: 'Escape' })
  expect(screen.getByTestId('2').getAttribute('data-focused')).toBe('true')
})
it('exits the menu with Tab near its source and dismisses it on resize or source removal', async () => {
  const api = setup(2)
  const tab = await screen.findByRole('tab', { name: 'Pi 2' })
  fireEvent.contextMenu(tab)
  fireEvent.keyDown(screen.getByRole('menuitem', { name: 'Rename' }), { key: 'Tab' })
  expect(screen.queryByRole('menu')).toBeNull()
  expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Close Pi 2' }))
  fireEvent.contextMenu(tab)
  fireEvent(window, new Event('resize'))
  expect(screen.queryByRole('menu')).toBeNull()
  fireEvent.contextMenu(tab)
  act(() => vi.mocked(api.onEvent).mock.calls[0][0]({ type: 'removed', id: '2' }))
  expect(screen.queryByRole('menu')).toBeNull()
})
it('renames a tab inline on Enter without restarting its process', async () => {
  const api = setup(2)
  fireEvent.doubleClick(await screen.findByRole('tab', { name: 'Pi 1' }))
  const input = screen.getByRole('textbox', { name: 'Rename terminal' })
  expect(document.activeElement).toBe(input)
  fireEvent.change(input, { target: { value: '  Backend  ' } })
  fireEvent.keyDown(input, { key: 'Enter' })
  await screen.findByRole('tab', { name: 'Backend' })
  expect(api.rename).toHaveBeenCalledWith('1', 'Backend')
  expect(screen.getByRole('tab', { name: 'Pi 2' })).toBeTruthy()
  expect(api.restart).not.toHaveBeenCalled()
})
it('cancels rename with Escape, ignores blanks and saves on blur', async () => {
  const api = setup()
  const edit = async (name: string) => {
    fireEvent.doubleClick(await screen.findByRole('tab', { name: 'Pi 1' }))
    const input = screen.getByRole('textbox', { name: 'Rename terminal' })
    fireEvent.change(input, { target: { value: name } })
    return input
  }
  fireEvent.keyDown(await edit('Cancelled'), { key: 'Escape' })
  expect(api.rename).not.toHaveBeenCalled()
  fireEvent.keyDown(await edit('   '), { key: 'Enter' })
  expect(api.rename).not.toHaveBeenCalled()
  const input = await edit('Frontend')
  fireEvent.keyDown(input, { key: 'ArrowLeft' })
  expect(document.activeElement).toBe(input)
  fireEvent.blur(input)
  await screen.findByRole('tab', { name: 'Frontend' })
})
it('keeps folders per session and inherits the active session folder', async () => {
  const api = setup()
  await screen.findByRole('tab', { name: 'Pi 1' })
  expect(screen.getByRole('button', { name: 'New session options in group 1' })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'New terminal in folder…' }))
  await screen.findByRole('tab', { name: 'Pi 2' })
  expect(api.chooseFolder).toHaveBeenCalledWith('/tmp')
  expect(api.create).toHaveBeenLastCalledWith('/project')
  expect(screen.getByTitle('/project')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'New session in group 1' }))
  await screen.findByRole('tab', { name: 'Pi 3' })
  expect(api.create).toHaveBeenLastCalledWith('/project', 'pi')
  fireEvent.click(screen.getByRole('tab', { name: 'Pi 1' }))
  expect(screen.getByTitle('/tmp')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'New session in group 1' }))
  await screen.findByRole('tab', { name: 'Pi 4' })
  expect(api.create).toHaveBeenLastCalledWith('/tmp', 'pi')
  expect(api.restart).not.toHaveBeenCalled(); expect(api.stop).not.toHaveBeenCalled()
})
it('does not create a session when folder selection is cancelled', async () => {
  const api = setup()
  await screen.findByRole('tab', { name: 'Pi 1' })
  vi.mocked(api.chooseFolder).mockResolvedValueOnce(null)
  fireEvent.click(screen.getByRole('button', { name: 'New terminal in folder…' }))
  await waitFor(() => expect(api.chooseFolder).toHaveBeenCalled())
  expect(api.create).not.toHaveBeenCalled()
  expect(screen.getByTitle('/tmp')).toBeTruthy()
})

it('creates up to four panes from the focused session and disables further splits', async () => {
  const api = setup()
  await screen.findByRole('tab', { name: 'Pi 1' })
  fireEvent.click(screen.getByRole('button', { name: 'New session in split right' }))
  await screen.findByRole('tab', { name: 'Pi 2' })
  fireEvent.click(screen.getByRole('button', { name: 'New session in split down' }))
  await screen.findByRole('tab', { name: 'Pi 3' })
  fireEvent.click(screen.getByRole('tab', { name: 'Pi 1' }))
  fireEvent.click(screen.getByRole('button', { name: 'New session in split down' }))
  await screen.findByRole('tab', { name: 'Pi 4' })
  expect(screen.getAllByRole('tablist')).toHaveLength(4)
  expect(screen.getAllByRole('separator')).toHaveLength(3)
  expect(screen.getByRole('button', { name: 'New session in split right' }).hasAttribute('disabled')).toBe(true)
  expect(api.create).toHaveBeenCalledTimes(3)
  expect(api.restart).not.toHaveBeenCalled(); expect(api.stop).not.toHaveBeenCalled()
})
