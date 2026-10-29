import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import type { GitBranches, GitChangeKind, GitDiff, GitDiffArea, GitFileChange, GitLineStats, GitOperation, GitRepoStatus, GitSwitchOptions } from '../shared/types'

export const MAX_DIFF_BYTES = 512 * 1024
export const MAX_MESSAGE = 10_000
const MAX_CHANGES = 500
const MAX_CONTEXT_PATCH = 24_000
const NO_EXT = ['--no-ext-diff', '--no-textconv']

export interface GitResult { code: number; stdout: string; stderr: string; overflow?: boolean }
export interface GitRunOptions { maxBuffer?: number; timeout?: number }
export type GitRunner = (cwd: string, args: string[], options?: GitRunOptions) => Promise<GitResult>

export const runGit: GitRunner = (cwd, args, { maxBuffer = 8 * 1024 * 1024, timeout = 15_000 } = {}) => new Promise((resolve, reject) => {
  execFile('git', ['-c', 'color.ui=false', '-c', 'core.quotepath=false', ...args], {
    cwd, maxBuffer, timeout, windowsHide: true, encoding: 'utf8',
    // Optional locks off so polling never contends with the agent's own git commands;
    // literal pathspecs so file names containing *, ? or : are never treated as globs.
    env: { ...process.env, GIT_OPTIONAL_LOCKS: '0', GIT_LITERAL_PATHSPECS: '1', GIT_TERMINAL_PROMPT: '0', GIT_PAGER: 'cat' }
  }, (error, stdout, stderr) => {
    const code = (error as { code?: unknown } | null)?.code
    if (code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER') return resolve({ code: 0, stdout: '', stderr: '', overflow: true })
    if (error && typeof code !== 'number') return reject(error)
    resolve({ code: typeof code === 'number' ? code : 0, stdout, stderr })
  })
})

function columnKind(c: string): GitChangeKind | undefined {
  if (c === 'M' || c === 'T') return 'modified'
  if (c === 'A' || c === 'C') return 'added'
  if (c === 'D') return 'deleted'
  if (c === 'R') return 'renamed'
  return undefined
}
const conflicted = (x: string, y: string) => x === 'U' || y === 'U' || (x === 'A' && y === 'A') || (x === 'D' && y === 'D')

export interface BranchInfo { branch?: string; detached?: boolean; upstream?: string; ahead: number; behind: number }
export function parseBranch(raw: string): BranchInfo {
  const text = raw.replace(/^(No commits yet|Initial commit) on /, '')
  if (text.startsWith('HEAD (no branch)')) return { detached: true, ahead: 0, behind: 0 }
  const match = /^(.+?)(?:\.\.\.(\S+))?(?: \[(.+)\])?$/.exec(text)
  const tracking = match?.[3] ?? ''
  return { branch: match?.[1], upstream: match?.[2], ahead: Number(/ahead (\d+)/.exec(tracking)?.[1] ?? 0), behind: Number(/behind (\d+)/.exec(tracking)?.[1] ?? 0) }
}

/** Parses `git status --porcelain=v1 -z -b`, keeping the staged (X) and unstaged (Y) columns apart. */
export function parseStatus(out: string): BranchInfo & { changes: GitFileChange[] } {
  const parts = out.split('\0')
  const changes: GitFileChange[] = []
  let info: BranchInfo = { ahead: 0, behind: 0 }
  for (let i = 0; i < parts.length; i++) {
    const entry = parts[i]
    if (!entry) continue
    if (entry.startsWith('## ')) { info = parseBranch(entry.slice(3)); continue }
    const x = entry[0], y = entry[1], file = entry.slice(3)
    if (x === '!') continue
    let change: GitFileChange
    if (x === '?') change = { path: file, status: 'untracked', worktreeStatus: 'untracked', staged: false, unstaged: true }
    else if (conflicted(x, y)) change = { path: file, status: 'conflicted', worktreeStatus: 'conflicted', staged: false, unstaged: true }
    else {
      const indexStatus = columnKind(x), worktreeStatus = columnKind(y)
      change = { path: file, status: indexStatus ?? worktreeStatus ?? 'modified', staged: !!indexStatus, unstaged: !!worktreeStatus }
      if (indexStatus) change.indexStatus = indexStatus
      if (worktreeStatus) change.worktreeStatus = worktreeStatus
    }
    // With -z, renames and copies are followed by the original path as a separate field.
    if ('RC'.includes(x) || 'RC'.includes(y)) change.oldPath = parts[++i]
    changes.push(change)
  }
  return { ...info, changes }
}

/** Parses `git diff --numstat -z` into per-path counts. */
export function parseNumstat(out: string) {
  const stats = new Map<string, GitLineStats>()
  const parts = out.split('\0')
  for (let i = 0; i < parts.length; i++) {
    if (!parts[i]) continue
    const [added, deleted, file] = parts[i].split('\t')
    let target = file
    if (file === '') { target = parts[i + 2]; i += 2 } // rename: "a\td\t\0old\0new"
    const binary = added === '-'
    stats.set(target, binary ? { binary } : { binary, insertions: Number(added), deletions: Number(deleted) })
  }
  return stats
}

const OPERATIONS: [string, GitOperation][] = [['MERGE_HEAD', 'merge'], ['rebase-merge', 'rebase'], ['rebase-apply', 'rebase'], ['CHERRY_PICK_HEAD', 'cherry-pick'], ['REVERT_HEAD', 'revert']]
interface RepoState extends BranchInfo { root: string; head: boolean; operation?: GitOperation; changes: GitFileChange[] }
export interface CommitContext { recent: string[]; stat: string; patch: string; truncated: boolean }

/**
 * Source control for a session's repository. Staged changes compare the index with HEAD,
 * unstaged changes compare the working tree with the index, like `git diff --cached` / `git diff`.
 */
export class GitService {
  private inflight = new Map<string, Promise<GitRepoStatus>>()
  constructor(private trash: (file: string) => Promise<void>, private run: GitRunner = runGit) {}

  status(cwd: string): Promise<GitRepoStatus> {
    // Several panes may share one repo; collapse concurrent polls into a single git call.
    const pending = this.inflight.get(cwd)
    if (pending) return pending
    const request = this.read(cwd).then((s): GitRepoStatus => s
      ? { isRepo: true, root: s.root, branch: s.branch, detached: s.detached, hasHead: s.head, upstream: s.upstream, ahead: s.ahead, behind: s.behind, operation: s.operation, changes: s.changes.slice(0, MAX_CHANGES), truncated: s.changes.length > MAX_CHANGES }
      : { isRepo: false, changes: [] }
    ).finally(() => this.inflight.delete(cwd))
    this.inflight.set(cwd, request)
    return request
  }

  async diff(cwd: string, file: string, area: GitDiffArea): Promise<GitDiff> {
    if (area !== 'staged' && area !== 'unstaged') throw new Error('Invalid diff area')
    const { root, head, change } = await this.find(cwd, file)
    if (!(area === 'staged' ? change.staged : change.unstaged)) throw new Error(`File has no ${area} changes`)
    const untracked = change.status === 'untracked'
    const args = untracked ? ['diff', '--no-index', ...NO_EXT, '--', '/dev/null', change.path]
      // Conflicts produce combined diffs; comparing with HEAD shows the conflict markers as plain lines.
      : change.status === 'conflicted' ? ['diff', ...(head ? ['HEAD'] : []), ...NO_EXT, '--', change.path]
      : area === 'staged' ? ['diff', '--cached', '-M', ...NO_EXT, '--', ...paths(change)]
      : ['diff', ...NO_EXT, '--', change.path]
    const result = await this.run(root, args, { maxBuffer: MAX_DIFF_BYTES })
    const base = { path: change.path, area, untracked }
    if (result.overflow) return { ...base, binary: false, tooLarge: true, patch: '' }
    // `diff --no-index` exits 1 when the files differ, which is the expected case.
    if (result.code > 1 || (result.code === 1 && !untracked)) throw new Error(result.stderr.trim() || 'git diff failed')
    const binary = /^(Binary files .* differ|GIT binary patch)$/m.test(result.stdout)
    return { ...base, binary, tooLarge: false, patch: binary ? '' : result.stdout }
  }

  async stage(cwd: string, file: string) {
    const { root, change } = await this.find(cwd, file)
    if (!change.unstaged) throw new Error('File has no unstaged changes')
    await this.mutate(root, ['add', '-A', '--', ...paths(change)])
  }

  async stageAll(cwd: string) { await this.mutate(await this.root(cwd), ['add', '-A']) }

  async unstage(cwd: string, file: string) {
    const { root, head, change } = await this.find(cwd, file)
    if (!change.staged) throw new Error('File has no staged changes')
    await this.mutate(root, head ? ['restore', '--staged', '--', ...paths(change)] : ['rm', '--cached', '-r', '-q', '--', ...paths(change)])
  }

  async unstageAll(cwd: string) {
    const state = await this.require(cwd)
    if (!state.changes.some((c) => c.staged)) return
    await this.mutate(state.root, state.head ? ['reset', '-q'] : ['rm', '--cached', '-r', '-q', '--', '.'])
  }

  /** Drops unstaged edits only: tracked files return to their staged version, new files go to the trash. */
  async discard(cwd: string, file: string) {
    const { root, change } = await this.find(cwd, file)
    if (!change.unstaged) throw new Error('File has no unstaged changes')
    if (change.status === 'conflicted') throw new Error('Resolve the conflict before discarding')
    if (change.status === 'untracked') {
      const target = path.resolve(root, change.path)
      if (!target.startsWith(path.resolve(root) + path.sep)) throw new Error('File is outside the repository')
      return this.trash(target)
    }
    await this.mutate(root, ['restore', '--worktree', '--', change.path])
  }

  /** Commits the index with repository hooks enabled. */
  async commit(cwd: string, message: string): Promise<{ hash: string }> {
    if (typeof message !== 'string' || !message.trim() || message.length > MAX_MESSAGE) throw new Error('Enter a commit message')
    const state = await this.require(cwd)
    if (!state.changes.some((c) => c.staged) && state.operation !== 'merge') throw new Error('Stage changes before committing')
    if (state.changes.some((c) => c.status === 'conflicted')) throw new Error('Resolve conflicts before committing')
    // Hooks such as lint-staged can take a while.
    const result = await this.run(state.root, ['commit', '-q', '-m', message.trim()], { timeout: 120_000 })
    if (result.code) throw new Error((result.stderr || result.stdout).trim() || 'git commit failed')
    const hash = await this.run(state.root, ['rev-parse', '--short', 'HEAD'])
    return { hash: hash.stdout.trim() }
  }

  /** Pushes commits to the remote repository. */
  async push(cwd: string): Promise<void> {
    const state = await this.require(cwd)
    if (state.detached) throw new Error('Cannot push in detached HEAD state')
    const args = ['push']
    if (!state.upstream && state.branch) {
      const remotes = await this.run(state.root, ['remote'])
      const remoteList = remotes.stdout.split('\n').map((s) => s.trim()).filter(Boolean)
      if (remoteList.length === 1) args.push('-u', remoteList[0], state.branch)
    }
    const result = await this.run(state.root, args, { timeout: 120_000 })
    if (result.code) throw new Error((result.stderr || result.stdout).trim() || 'git push failed')
  }

  /** Recent subjects and the staged diff, used to draft a commit message in the repository's style. */
  async commitContext(cwd: string): Promise<CommitContext> {
    const state = await this.require(cwd)
    if (!state.changes.some((c) => c.staged)) throw new Error('Stage changes before generating a message')
    const [log, stat, patch] = await Promise.all([
      state.head ? this.run(state.root, ['log', '-n', '15', '--format=%s']) : Promise.resolve({ code: 0, stdout: '', stderr: '' }),
      this.run(state.root, ['diff', '--cached', '-M', '--stat=120', ...NO_EXT]),
      this.run(state.root, ['diff', '--cached', '-M', ...NO_EXT], { maxBuffer: 2 * 1024 * 1024 })
    ])
    const full = patch.overflow ? '' : patch.stdout
    return {
      recent: log.stdout.split('\n').map((s) => s.trim()).filter(Boolean),
      stat: stat.stdout.trim(),
      patch: full.slice(0, MAX_CONTEXT_PATCH),
      truncated: patch.overflow === true || full.length > MAX_CONTEXT_PATCH
    }
  }

  async branches(cwd: string): Promise<GitBranches> {
    const state = await this.require(cwd)
    const out = await this.run(state.root, ['for-each-ref', '--sort=-committerdate', '--format=%(refname)%00%(refname:short)%00%(HEAD)%00%(upstream:short)%00%(committerdate:relative)', 'refs/heads', 'refs/remotes'])
    if (out.code) throw new Error(out.stderr.trim() || 'Could not list branches')
    const result: GitBranches = { current: state.detached ? undefined : state.branch, local: [], remote: [] }
    for (const line of out.stdout.split('\n')) {
      const [ref, name, head, upstream, date] = line.split('\0')
      if (!ref || ref.endsWith('/HEAD')) continue
      if (ref.startsWith('refs/heads/')) result.local.push({ name, current: head === '*', upstream: upstream || undefined, date: date || undefined })
      else result.remote.push({ name, localName: name.slice(name.indexOf('/') + 1), date: date || undefined })
    }
    // Remote branches that already have a local branch are switched to through the local one.
    result.remote = result.remote.filter((r) => !result.local.some((l) => l.name === r.localName))
    return result
  }

  async switchBranch(cwd: string, target: string, options: GitSwitchOptions = {}): Promise<{ stashed: boolean }> {
    if (typeof target !== 'string' || !target || target.length > 250 || target.startsWith('-') || target.includes('@{')) throw new Error('Invalid branch name')
    const state = await this.require(cwd)
    if (state.operation) throw new Error(`Finish or abort the ${state.operation} before switching branches`)
    if ((await this.run(state.root, ['check-ref-format', '--branch', target])).code) throw new Error(`"${target}" is not a valid branch name`)
    const { local, remote } = await this.branches(state.root)
    let args: string[]
    if (options.create) {
      if (local.some((b) => b.name === target)) throw new Error(`Branch "${target}" already exists`)
      args = ['switch', '-c', target]
    } else if (local.some((b) => b.name === target)) {
      if (!state.detached && state.branch === target) return { stashed: false }
      args = ['switch', target]
    } else if (remote.some((b) => b.name === target)) args = ['switch', '--track', target]
    else throw new Error(`Unknown branch "${target}"`)

    const stashed = options.stash === true && state.changes.length > 0
    // With GIT_LITERAL_PATHSPECS, `stash push -u` silently skips untracked files unless a pathspec is given.
    if (stashed) await this.mutate(state.root, ['stash', 'push', '-u', '-q', '-m', `Shumora: before switching to ${target}`, '--', '.'])
    const result = await this.run(state.root, args, { timeout: 60_000 })
    if (result.code) {
      const reason = (result.stderr || result.stdout).trim() || 'git switch failed'
      if (!stashed) throw new Error(reason)
      const restore = await this.run(state.root, ['stash', 'pop', '-q'])
      throw new Error(`${reason}\n${restore.code ? 'Your changes remain in the stash (git stash list).' : 'Your changes were restored from the stash.'}`)
    }
    return { stashed }
  }

  private async mutate(root: string, args: string[]) {
    const result = await this.run(root, args)
    if (result.code) throw new Error((result.stderr || result.stdout).trim() || `git ${args[0]} failed`)
  }

  private async root(cwd: string) { return (await this.require(cwd)).root }
  private async require(cwd: string) {
    const state = await this.read(cwd)
    if (!state) throw new Error('Not a git repository')
    return state
  }

  /** Only paths currently reported by git status may be diffed or changed. */
  private async find(cwd: string, file: unknown) {
    if (typeof file !== 'string' || !file || file.length > 4096) throw new Error('Invalid file path')
    const state = await this.require(cwd)
    const change = state.changes.find((c) => c.path === file)
    if (!change) throw new Error('File has no pending changes')
    return { root: state.root, head: state.head, change }
  }

  private async read(cwd: string): Promise<RepoState | undefined> {
    const top = await this.run(cwd, ['rev-parse', '--show-toplevel', '--absolute-git-dir']).catch(() => undefined)
    if (!top || top.code) return undefined
    const [root, gitDir] = top.stdout.trim().split('\n')
    const [status, headCheck] = await Promise.all([
      this.run(root, ['status', '--porcelain=v1', '-z', '-b', '-uall']),
      this.run(root, ['rev-parse', '--verify', '--quiet', 'HEAD'])
    ])
    if (status.code) throw new Error(status.stderr.trim() || 'git status failed')
    const parsed = parseStatus(status.stdout)
    if (parsed.changes.some((c) => c.staged || (c.unstaged && c.status !== 'untracked'))) {
      const [staged, unstaged] = await Promise.all([
        this.run(root, ['diff', '--cached', '-M', '--numstat', '-z', ...NO_EXT]),
        this.run(root, ['diff', '--numstat', '-z', ...NO_EXT])
      ])
      const stagedStats = staged.code ? new Map() : parseNumstat(staged.stdout)
      const unstagedStats = unstaged.code ? new Map() : parseNumstat(unstaged.stdout)
      for (const change of parsed.changes) {
        if (change.staged && stagedStats.has(change.path)) change.stagedStats = stagedStats.get(change.path)
        if (change.unstaged && unstagedStats.has(change.path)) change.unstagedStats = unstagedStats.get(change.path)
      }
    }
    const operation = gitDir ? OPERATIONS.find(([file]) => existsSync(path.join(gitDir, file)))?.[1] : undefined
    return { ...parsed, root, head: headCheck.code === 0, operation }
  }
}

function paths(change: GitFileChange) { return change.oldPath ? [change.oldPath, change.path] : [change.path] }
