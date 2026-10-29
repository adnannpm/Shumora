// @vitest-environment jsdom
import React from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { GitFileChange, Session } from '../src/shared/types'
import { GitReviewButton, sessionsInRepo, toRows } from '../src/renderer/src/GitReview'
import { Provider } from '../src/renderer/src/Provider'
afterEach(() => { cleanup(); vi.restoreAllMocks() })

it('pairs removed and added lines side by side with line numbers', () => {
  const rows = toRows('diff --git a/a b/a\n--- a/a\n+++ b/a\n@@ -1,2 +1,3 @@\n one\n-two\n+TWO\n+three\n')
  expect(rows.map((r) => r.kind)).toEqual(['hunk', 'context', 'change', 'change'])
  expect(rows[2]).toMatchObject({ left: { no: 2, text: 'two', removed: true }, right: { no: 2, text: 'TWO', added: true } })
  expect(rows[3].left).toBeUndefined(); expect(rows[3].right).toMatchObject({ no: 3, text: 'three' })
})

it('finds other running sessions inside the same repository', () => {
  const s = (id: string, cwd: string, status: Session['status'] = 'running'): Session => ({ id, name: id, cwd, status, generation: 1 })
  const list = [s('self', '/repo'), s('sub', '/repo/pkg'), s('other', '/repo-two'), s('stopped', '/repo', 'exited')]
  expect(sessionsInRepo(list, '/repo', 'self').map((x) => x.id)).toEqual(['sub'])
})

function api(changes: GitFileChange[]) {
  return {
    gitStatus: vi.fn(async () => ({ isRepo: true, branch: 'main', changes })),
    gitDiff: vi.fn(async (_id: string, path: string, area: string) => ({ path, area, untracked: false, binary: false, tooLarge: false, patch: `@@ -1 +1 @@\n-old\n+${area}\n` })),
    gitStage: vi.fn(async () => {}), gitUnstage: vi.fn(async () => {}), gitStageAll: vi.fn(async () => {}), gitUnstageAll: vi.fn(async () => {}),
    gitDiscard: vi.fn(async () => {}), gitCommit: vi.fn(async () => ({ hash: 'abc123' })),
    gitPush: vi.fn(async () => {}),
    gitCommitModels: vi.fn(async () => ['kr/auto', 'ag/flash']), gitGenerateMessage: vi.fn(async () => 'feat: generated'),
    gitBranches: vi.fn(async () => ({ current: 'main', local: [{ name: 'main', current: true }, { name: 'dev', current: false }], remote: [{ name: 'origin/release', localName: 'release' }] })),
    gitSwitch: vi.fn(async () => ({ stashed: false }))
  }
}

it('explains when the terminal folder is outside a repository', async () => {
  window.workspace = { gitStatus: async () => ({ isRepo: false, changes: [] }) } as any
  render(<Provider><GitReviewButton sessionId="one" visible /></Provider>)
  expect(await screen.findByRole('button', { name: /Not a Git repository/ })).toBeTruthy()
})

it('reviews staged and unstaged sections, stages, unstages and confirms discard', async () => {
  const mock = api([
    { path: 'src/a.ts', status: 'modified', indexStatus: 'modified', worktreeStatus: 'modified', staged: true, unstaged: true, stagedStats: { binary: false, insertions: 1, deletions: 1 }, unstagedStats: { binary: false, insertions: 2, deletions: 0 } },
    { path: 'b.ts', status: 'untracked', worktreeStatus: 'untracked', staged: false, unstaged: true }
  ])
  window.workspace = mock as any
  render(<Provider><GitReviewButton sessionId="one" visible /></Provider>)
  fireEvent.click(await screen.findByTitle('Review 2 changed files'))
  const staged = await screen.findByRole('region', { name: 'Staged changes' })
  const changes = screen.getByRole('region', { name: 'Changes' })
  expect(within(staged).getByText('src/a.ts')).toBeTruthy()
  expect(within(changes).getByText('b.ts')).toBeTruthy()

  // Unstaged part is selected first and diffed against the index.
  await waitFor(() => expect(mock.gitDiff).toHaveBeenCalledWith('one', 'src/a.ts', 'unstaged'))
  fireEvent.click(screen.getByText('git add'))
  await waitFor(() => expect(mock.gitStage).toHaveBeenCalledWith('one', 'src/a.ts'))
  fireEvent.click(screen.getByText('git restore'))
  expect(await screen.findByText(/staged changes are kept/)).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'git restore' }))
  await waitFor(() => expect(mock.gitDiscard).toHaveBeenCalledWith('one', 'src/a.ts'))

  fireEvent.click(within(staged).getByText('src/a.ts'))
  await waitFor(() => expect(mock.gitDiff).toHaveBeenCalledWith('one', 'src/a.ts', 'staged'))
  fireEvent.click(screen.getByText('git restore --staged'))
  await waitFor(() => expect(mock.gitUnstage).toHaveBeenCalledWith('one', 'src/a.ts'))
  fireEvent.click(within(changes).getByTitle(/git add \./))
  await waitFor(() => expect(mock.gitStageAll).toHaveBeenCalledWith('one'))
})

it.each(['modified', 'untracked'] as const)('reloads the selected %s diff on refresh even when line counts are unchanged', async status => {
  const mock = api([{ path: 'a.ts', status, worktreeStatus: status, staged: false, unstaged: true,
    ...(status === 'modified' ? { unstagedStats: { binary: false, insertions: 1, deletions: 1 } } : {}) }])
  let content = 'initial-content'
  mock.gitStatus.mockImplementation(async () => ({ isRepo: true, branch: 'main', changes: [{ path: 'a.ts', status, worktreeStatus: status, staged: false, unstaged: true,
    ...(status === 'modified' ? { unstagedStats: { binary: false, insertions: 1, deletions: 1 } } : {}) }] }))
  mock.gitDiff.mockImplementation(async (_id, path, area) => ({ path, area, untracked: status === 'untracked', binary: false, tooLarge: false, patch: `@@ -1 +1 @@\n-old\n+${content}\n` }))
  window.workspace = mock as any
  render(<Provider><GitReviewButton sessionId="one" visible /></Provider>)
  fireEvent.click(await screen.findByTitle('Review 1 changed file'))
  expect(await screen.findByText('initial-content')).toBeTruthy()
  content = 'refreshed-content'
  fireEvent.click(screen.getByTitle('Refresh changes'))
  expect(await screen.findByText('refreshed-content')).toBeTruthy()
  expect(screen.queryByText('initial-content')).toBeNull()
  content = 'focus-refreshed-content'
  fireEvent.focus(window)
  expect(await screen.findByText('focus-refreshed-content')).toBeTruthy()
  expect(screen.queryByText('refreshed-content')).toBeNull()
})
it('generates a message with the chosen model and commits', async () => {
  const mock = api([{ path: 'a.ts', status: 'modified', indexStatus: 'modified', staged: true, unstaged: false }])
  window.workspace = mock as any
  render(<Provider><GitReviewButton sessionId="one" visible /></Provider>)
  fireEvent.click(await screen.findByTitle('Review 1 changed file'))
  const select = await screen.findByRole('combobox', { name: 'Model for commit messages' })
  await waitFor(() => expect((select as HTMLSelectElement).value).toBe('kr/auto'))
  fireEvent.change(select, { target: { value: 'ag/flash' } })
  fireEvent.click(screen.getByText('Generate'))
  const box = screen.getByRole('textbox', { name: 'Commit message' }) as HTMLTextAreaElement
  await waitFor(() => expect(box.value).toBe('feat: generated'))
  expect(mock.gitGenerateMessage).toHaveBeenCalledWith('one', 'ag/flash')
  fireEvent.change(box, { target: { value: 'feat: edited' } })
  fireEvent.click(screen.getByText(/git commit \(1 file\)/))
  await waitFor(() => expect(mock.gitCommit).toHaveBeenCalledWith('one', 'feat: edited'))
  expect(await screen.findByText('Committed abc123')).toBeTruthy()
})

it('pushes commits to the remote', async () => {
  const mock = api([])
  mock.gitStatus.mockResolvedValue({ isRepo: true, branch: 'main', ahead: 2, changes: [] } as any)
  window.workspace = mock as any
  render(<Provider><GitReviewButton sessionId="one" visible /></Provider>)
  fireEvent.click(await screen.findByTitle('Working tree clean'))
  const pushBtn = await screen.findByRole('button', { name: /git push/ })
  expect(pushBtn.textContent).toContain('git push')
  expect(pushBtn.querySelector('.git-push-count')?.textContent).toBe('2')
  fireEvent.click(pushBtn)
  await waitFor(() => expect(mock.gitPush).toHaveBeenCalledWith('one'))
})

it('switches branches and warns about running sessions and uncommitted work', async () => {
  const mock = api([{ path: 'a.ts', status: 'modified', worktreeStatus: 'modified', staged: false, unstaged: true }])
  window.workspace = mock as any
  const sessions: Session[] = [{ id: 'one', name: 'Pi 1', cwd: '/repo', status: 'running', generation: 1 }]
  mock.gitStatus.mockResolvedValue({ isRepo: true, root: '/repo', branch: 'main', changes: (await mock.gitStatus()).changes } as any)
  render(<Provider><GitReviewButton sessionId="one" visible sessions={sessions} /></Provider>)
  fireEvent.click(await screen.findByTitle('Switch branch'))
  fireEvent.click(await screen.findByText('dev'))
  expect(await screen.findByText(/running Pi session Pi 1/)).toBeTruthy()
  fireEvent.click(screen.getByText('Stash and switch'))
  await waitFor(() => expect(mock.gitSwitch).toHaveBeenCalledWith('one', 'dev', { create: false, stash: true }))
})

it('creates a branch from the search box', async () => {
  const mock = api([])
  window.workspace = mock as any
  render(<Provider><GitReviewButton sessionId="one" visible /></Provider>)
  fireEvent.click(await screen.findByTitle('Switch branch'))
  const search = await screen.findByRole('textbox', { name: 'Search or create branch' })
  fireEvent.change(search, { target: { value: 'feature/new' } })
  fireEvent.click(await screen.findByText(/Create branch/))
  await waitFor(() => expect(mock.gitSwitch).toHaveBeenCalledWith('one', 'feature/new', { create: true, stash: false }))
})
