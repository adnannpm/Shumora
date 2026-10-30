import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import type { AskPassService } from './askpass-service'
import type { GitBranches, GitChangeKind, GitCommitSummary, GitDiff, GitDiffArea, GitFileChange, GitLineStats, GitOperation, GitPushInfo, GitPushOptions, GitRepoStatus, GitSwitchOptions } from '../shared/types'

export const MAX_DIFF_BYTES = 512 * 1024
export const MAX_MESSAGE = 10_000
const MAX_CHANGES = 500
const MAX_CONTEXT_PATCH = 24_000
const NO_EXT = ['--no-ext-diff', '--no-textconv']

export interface GitResult { code: number; stdout: string; stderr: string; overflow?: boolean }
export interface GitRunOptions { maxBuffer?: number; timeout?: number; env?: Record<string, string> }
export type GitRunner = (cwd: string, args: string[], options?: GitRunOptions) => Promise<GitResult>

export const runGit: GitRunner = (cwd, args, { maxBuffer = 8 * 1024 * 1024, timeout = 15_000, env = {} } = {}) => new Promise((resolve, reject) => {
  execFile('git', ['-c', 'color.ui=false', '-c', 'core.quotepath=false', ...args], {
    cwd, maxBuffer, timeout, windowsHide: true, encoding: 'utf8',
    // Optional locks off so polling never contends with the agent's own git commands;
    // literal pathspecs so file names containing *, ? or : are never treated as globs.
    env: { ...process.env, GIT_OPTIONAL_LOCKS: '0', GIT_LITERAL_PATHSPECS: '1', GIT_TERMINAL_PROMPT: '0', GIT_PAGER: 'cat', ...env }
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
interface RepoState extends BranchInfo { root: string; head: boolean; operation?: GitOperation; changes: GitFileChange[]; lastCommit?: GitCommitSummary }
export interface CommitContext { recent: string[]; stat: string; patch: string; truncated: boolean }

/**
 * Source control for a session's repository. Staged changes compare the index with HEAD,
 * unstaged changes compare the working tree with the index, like `git diff --cached` / `git diff`.
 */
export class GitService {
  private inflight = new Map<string, Promise<GitRepoStatus>>()
  constructor(private trash: (file: string) => Promise<void>, private run: GitRunner = runGit, private askPass?: AskPassService) {}

  status(cwd: string): Promise<GitRepoStatus> {
    // Several panes may share one repo; collapse concurrent polls into a single git call.
    const pending = this.inflight.get(cwd)
    if (pending) return pending
    const request = this.read(cwd).then((s): GitRepoStatus => s
      ? { isRepo: true, root: s.root, branch: s.branch, detached: s.detached, hasHead: s.head, upstream: s.upstream, ahead: s.ahead, behind: s.behind, operation: s.operation, changes: s.changes.slice(0, MAX_CHANGES), truncated: s.changes.length > MAX_CHANGES, lastCommit: s.lastCommit }
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

  async stage(cwd: string, file: string | string[]) {
    const files = Array.isArray(file) ? file : [file]
    if (!files.length) return
    const state = await this.require(cwd)
    const allPaths: string[] = []
    for (const f of files) {
      const change = state.changes.find((c) => c.path === f)
      if (!change) throw new Error(`File ${f} has no pending changes`)
      if (!change.unstaged) throw new Error(`File ${f} has no unstaged changes`)
      allPaths.push(...paths(change))
    }
    await this.mutate(state.root, ['add', '-A', '--', ...allPaths])
  }

  async stageAll(cwd: string) { await this.mutate(await this.root(cwd), ['add', '-A']) }

  async unstage(cwd: string, file: string | string[]) {
    const files = Array.isArray(file) ? file : [file]
    if (!files.length) return
    const state = await this.require(cwd)
    const allPaths: string[] = []
    for (const f of files) {
      const change = state.changes.find((c) => c.path === f)
      if (!change) throw new Error(`File ${f} has no pending changes`)
      if (!change.staged) throw new Error(`File ${f} has no staged changes`)
      allPaths.push(...paths(change))
    }
    await this.mutate(state.root, state.head ? ['restore', '--staged', '--', ...allPaths] : ['rm', '--cached', '-r', '-q', '--', ...allPaths])
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
  async push(cwd: string, options: GitPushOptions = {}): Promise<void> {
    const state = await this.require(cwd)
    const branch = options.branch || state.branch
    if (!branch) {
      if (state.detached) throw new Error('Cannot push in detached HEAD state')
      throw new Error('Cannot push without a branch')
    }
    const args = ['push']
    if (options.force) args.push('--force-with-lease')

    const remotes = await this.run(state.root, ['remote'])
    const remoteList = remotes.stdout.split('\n').map((s) => s.trim()).filter(Boolean)
    const remote = options.remote || (remoteList.includes('origin') ? 'origin' : remoteList[0])

    const upstreamOut = await this.run(state.root, ['rev-parse', '--abbrev-ref', `${branch}@{u}`])
    const hasUpstream = upstreamOut.code === 0 && !!upstreamOut.stdout.trim()

    if (options.setUpstream || (!hasUpstream && remote)) {
      if (remote) args.push('-u', remote, branch)
    } else if (options.branch && options.branch !== state.branch && remote) {
      args.push(remote, branch)
    }
    const askPassEnv = this.askPass?.getEnv() || {}
    const result = await this.run(state.root, args, { timeout: 120_000, env: askPassEnv })
    if (result.code) throw new Error((result.stderr || result.stdout).trim() || 'git push failed')
  }

  /** Details on unpushed commits and remote status for a branch before pushing. */
  async pushInfo(cwd: string, targetBranch?: string): Promise<GitPushInfo> {
    const state = await this.require(cwd)
    const branch = targetBranch || state.branch
    if (!branch) {
      if (state.detached) throw new Error('Cannot push in detached HEAD state')
      throw new Error('No branch selected')
    }

    const remotesOut = await this.run(state.root, ['remote'])
    const remotes = remotesOut.stdout.split('\n').map((s) => s.trim()).filter(Boolean)
    const remote = remotes.includes('origin') ? 'origin' : remotes[0]

    const upstreamOut = await this.run(state.root, ['rev-parse', '--abbrev-ref', `${branch}@{u}`])
    const hasUpstream = upstreamOut.code === 0 && !!upstreamOut.stdout.trim()
    let upstream = hasUpstream ? upstreamOut.stdout.trim() : undefined

    let targetRef: string | undefined = upstream
    if (!targetRef && remote) {
      const remoteRefOut = await this.run(state.root, ['rev-parse', '--verify', `${remote}/${branch}`])
      if (remoteRefOut.code === 0) {
        targetRef = `${remote}/${branch}`
        upstream = `${remote}/${branch}`
      }
    }

    let behind = 0
    let ahead = 0
    const commits: GitCommitSummary[] = []

    if (targetRef) {
      const [behindOut, logOut] = await Promise.all([
        this.run(state.root, ['rev-list', '--count', `${branch}..${targetRef}`]),
        this.run(state.root, ['log', `${targetRef}..${branch}`, '--format=%h%x00%s%x00%cr%x00%an', '-n', '50'])
      ])
      behind = Number(behindOut.stdout.trim()) || 0
      if (!logOut.code && logOut.stdout.trim()) {
        for (const line of logOut.stdout.split('\n')) {
          if (!line.trim()) continue
          const [hash, subject, date, author] = line.split('\0')
          commits.push({ hash, subject: subject || '', date: date || '', author: author || undefined })
        }
      }
      ahead = commits.length
    } else {
      let base: string | undefined
      if (remote) {
        for (const candidate of [`${remote}/HEAD`, `${remote}/main`, `${remote}/master`, 'main', 'master']) {
          const mb = await this.run(state.root, ['merge-base', branch, candidate])
          if (mb.code === 0 && mb.stdout.trim()) {
            base = mb.stdout.trim()
            break
          }
        }
      }
      const logArgs = base
        ? ['log', `${base}..${branch}`, '--format=%h%x00%s%x00%cr%x00%an', '-n', '50']
        : ['log', '-n', '20', branch, '--format=%h%x00%s%x00%cr%x00%an']
      const logOut = await this.run(state.root, logArgs)
      if (!logOut.code && logOut.stdout.trim()) {
        for (const line of logOut.stdout.split('\n')) {
          if (!line.trim()) continue
          const [hash, subject, date, author] = line.split('\0')
          commits.push({ hash, subject: subject || '', date: date || '', author: author || undefined })
        }
      }
      ahead = commits.length
    }

    return { branch, remote, upstream, hasUpstream, ahead, behind, commits }
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
    const [status, headCheck, lastCommitOut] = await Promise.all([
      this.run(root, ['status', '--porcelain=v1', '-z', '-b', '-uall']),
      this.run(root, ['rev-parse', '--verify', '--quiet', 'HEAD']),
      this.run(root, ['log', '-1', '--format=%h%x00%s%x00%cr', 'HEAD'])
    ])
    if (status.code) throw new Error(status.stderr.trim() || 'git status failed')
    const hasHead = headCheck.code === 0
    let lastCommit: GitCommitSummary | undefined
    if (hasHead && lastCommitOut.code === 0 && lastCommitOut.stdout.trim()) {
      const [hash, subject, date] = lastCommitOut.stdout.trim().split('\0')
      if (hash) lastCommit = { hash, subject: subject || '', date: date || '' }
    }
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
    return { ...parsed, root, head: hasHead, operation, lastCommit }
  }
}

function paths(change: GitFileChange) { return change.oldPath ? [change.oldPath, change.path] : [change.path] }
