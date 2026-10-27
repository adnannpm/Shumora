import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { GitService, parseBranch, parseNumstat, parseStatus } from '../src/main/git'

let dir: string
const git = (...args: string[]) => execFileSync('git', args, { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
const file = (name: string, text: string) => writeFileSync(path.join(dir, name), text)
const read = (name: string) => readFileSync(path.join(dir, name), 'utf8')
beforeEach(() => {
  // Git canonicalizes repository roots (macOS /var is a symlink to /private/var).
  dir = realpathSync(mkdtempSync(path.join(tmpdir(), 'shumora-git-')))
  git('init', '-q', '-b', 'main'); git('config', 'user.email', 't@example.com'); git('config', 'user.name', 'T'); git('config', 'commit.gpgsign', 'false')
  // Keep fixture bytes deterministic regardless of the runner's global Git config.
  git('config', 'core.autocrlf', 'false'); git('config', 'core.eol', 'lf')
  file('a.ts', 'one\ntwo\n'); file('gone.ts', 'x\n')
  git('add', '.'); git('commit', '-qm', 'feat: initial commit')
})
// Windows can briefly retain file handles after Git exits on a large diff.
afterEach(() => rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }))

it('parses porcelain status into staged and unstaged parts', () => {
  const out = '## main...origin/main [ahead 2, behind 1]\0MM a b.ts\0R  new.ts\0old.ts\0?? n.ts\0UU c.ts\0 D d.ts\0'
  const parsed = parseStatus(out)
  expect(parsed).toMatchObject({ branch: 'main', upstream: 'origin/main', ahead: 2, behind: 1 })
  expect(parsed.changes).toEqual([
    { path: 'a b.ts', status: 'modified', indexStatus: 'modified', worktreeStatus: 'modified', staged: true, unstaged: true },
    { path: 'new.ts', oldPath: 'old.ts', status: 'renamed', indexStatus: 'renamed', staged: true, unstaged: false },
    { path: 'n.ts', status: 'untracked', worktreeStatus: 'untracked', staged: false, unstaged: true },
    { path: 'c.ts', status: 'conflicted', worktreeStatus: 'conflicted', staged: false, unstaged: true },
    { path: 'd.ts', status: 'deleted', worktreeStatus: 'deleted', staged: false, unstaged: true }
  ])
  expect(parseBranch('No commits yet on dev')).toMatchObject({ branch: 'dev', ahead: 0 })
  expect(parseBranch('HEAD (no branch)')).toMatchObject({ detached: true })
  expect(parseNumstat('3\t1\ta.ts\0-\t-\timg.png\0').get('img.png')).toEqual({ binary: true })
})

it('reports non-repositories without failing', async () => {
  const plain = mkdtempSync(path.join(tmpdir(), 'shumora-plain-'))
  try { expect(await new GitService(async () => {}).status(plain)).toEqual({ isRepo: false, changes: [] }) } finally { rmSync(plain, { recursive: true, force: true }) }
})

it('separates staged and unstaged diffs, and discard keeps the staged version', async () => {
  const service = new GitService(async () => {})
  file('a.ts', 'one\nSTAGED\n'); git('add', 'a.ts')
  file('a.ts', 'one\nSTAGED\nlater\n')
  const [change] = (await service.status(dir)).changes
  expect(change).toMatchObject({ path: 'a.ts', staged: true, unstaged: true, stagedStats: { insertions: 1, deletions: 1 }, unstagedStats: { insertions: 1, deletions: 0 } })

  const staged = await service.diff(dir, 'a.ts', 'staged')
  expect(staged.patch).toContain('-two'); expect(staged.patch).toContain('+STAGED'); expect(staged.patch).not.toContain('later')
  const unstaged = await service.diff(dir, 'a.ts', 'unstaged')
  expect(unstaged.patch).toContain('+later'); expect(unstaged.patch).not.toContain('-two')

  // Discard only drops the unstaged edit: the staged checkpoint survives.
  await service.discard(dir, 'a.ts')
  expect(read('a.ts')).toBe('one\nSTAGED\n')
  expect((await service.status(dir)).changes[0]).toMatchObject({ staged: true, unstaged: false })
  await expect(service.discard(dir, 'a.ts')).rejects.toThrow(/no unstaged/)

  await service.unstage(dir, 'a.ts')
  expect((await service.status(dir)).changes[0]).toMatchObject({ staged: false, unstaged: true })
  expect(read('a.ts')).toBe('one\nSTAGED\n')
})

it('stages all, unstages all, trashes untracked files and restores deletions', async () => {
  const trash = vi.fn(async (target: string) => rmSync(target))
  const service = new GitService(trash)
  rmSync(path.join(dir, 'gone.ts'))
  mkdirSync(path.join(dir, 'sub')); file('sub/new file.ts', 'hello\n')
  expect((await service.diff(path.join(dir, 'sub'), 'sub/new file.ts', 'unstaged')).patch).toContain('+hello')

  await service.stageAll(dir)
  expect((await service.status(dir)).changes.every((c) => c.staged && !c.unstaged)).toBe(true)
  await service.unstageAll(dir)
  expect((await service.status(dir)).changes.every((c) => !c.staged && c.unstaged)).toBe(true)

  await service.discard(dir, 'gone.ts')
  expect(existsSync(path.join(dir, 'gone.ts'))).toBe(true)
  await service.discard(dir, 'sub/new file.ts')
  expect(trash).toHaveBeenCalledWith(path.join(dir, 'sub', 'new file.ts'))
  expect((await service.status(dir)).changes).toEqual([])
})

it('commits staged changes and builds commit context from recent subjects', async () => {
  const service = new GitService(async () => {})
  file('a.ts', 'changed\n')
  await expect(service.commit(dir, 'fix: nothing staged')).rejects.toThrow(/Stage changes/)
  await expect(service.commitContext(dir)).rejects.toThrow(/Stage changes/)
  await service.stage(dir, 'a.ts')
  const context = await service.commitContext(dir)
  expect(context.recent).toEqual(['feat: initial commit'])
  expect(context.stat).toContain('a.ts'); expect(context.patch).toContain('+changed')
  await expect(service.commit(dir, '   ')).rejects.toThrow(/commit message/)
  const { hash } = await service.commit(dir, 'fix: update a\n\nBody line')
  expect(hash).toMatch(/^[0-9a-f]{4,}$/)
  expect(git('log', '-1', '--format=%B').trim()).toBe('fix: update a\n\nBody line')
  expect((await service.status(dir)).changes).toEqual([])
})

it('reports commit hook failures', async () => {
  const hook = path.join(dir, '.git', 'hooks', 'pre-commit')
  writeFileSync(hook, '#!/bin/sh\necho "lint failed" >&2\nexit 1\n', { mode: 0o755 })
  const service = new GitService(async () => {})
  file('a.ts', 'x\n'); await service.stage(dir, 'a.ts')
  await expect(service.commit(dir, 'msg')).rejects.toThrow('lint failed')
})

it('lists, creates and switches branches, stashing when asked', async () => {
  const service = new GitService(async () => {})
  git('branch', 'feature/x')
  const branches = await service.branches(dir)
  expect(branches.current).toBe('main')
  expect(branches.local.map((b) => b.name).sort()).toEqual(['feature/x', 'main'])
  expect(branches.local.find((b) => b.name === 'main')?.current).toBe(true)

  await service.switchBranch(dir, 'feature/x')
  expect((await service.status(dir)).branch).toBe('feature/x')
  await service.switchBranch(dir, 'topic', { create: true })
  expect((await service.status(dir)).branch).toBe('topic')
  await expect(service.switchBranch(dir, 'topic', { create: true })).rejects.toThrow(/already exists/)
  for (const bad of ['bad..name', '-x', 'a@{1}', 'nope']) await expect(service.switchBranch(dir, bad)).rejects.toThrow()

  // Uncommitted work is carried by default, or stashed on request.
  file('a.ts', 'wip\n'); file('new.ts', 'n\n')
  await service.switchBranch(dir, 'main', { stash: true })
  expect((await service.status(dir)).changes).toEqual([])
  expect(git('stash', 'list')).toContain('Shumora: before switching to main')
  git('stash', 'pop', '-q')
  await service.switchBranch(dir, 'feature/x')
  expect(read('a.ts')).toBe('wip\n')
})

it('restores stashed work when the switch fails', async () => {
  const service = new GitService(async () => {})
  file('a.ts', 'wip\n')
  await expect(service.switchBranch(dir, 'missing', { stash: true })).rejects.toThrow(/Unknown branch/)
  expect(read('a.ts')).toBe('wip\n')
})

it('rejects paths that are not pending changes and invalid areas', async () => {
  const service = new GitService(async () => {})
  file('a.ts', 'changed\n')
  for (const bad of ['../outside', '/etc/passwd', 'gone.ts', '', 42 as unknown as string]) await expect(service.discard(dir, bad)).rejects.toThrow()
  await expect(service.diff(dir, 'a.ts', 'bogus' as any)).rejects.toThrow(/area/)
  await expect(service.diff(dir, 'a.ts', 'staged')).rejects.toThrow(/no staged/)
})

it('flags binary and oversized diffs', async () => {
  file('img.bin', Buffer.from([0, 1, 2, 0, 255]) as unknown as string)
  file('big.txt', 'line\n'.repeat(120_000))
  const service = new GitService(async () => {})
  expect(await service.diff(dir, 'img.bin', 'unstaged')).toMatchObject({ binary: true, patch: '' })
  expect(await service.diff(dir, 'big.txt', 'unstaged')).toMatchObject({ tooLarge: true, patch: '' })
})
