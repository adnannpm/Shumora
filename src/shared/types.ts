export interface Session {
  id: string
  name: string
  cwd: string
  status: 'running' | 'exited' | 'error'
  generation: number
  error?: string
  exitCode?: number
}
export interface Snapshot { session: Session; output: string; seq: number }
export type SessionEvent = { type: 'removed'; id: string } | { type: 'state'; session: Session } | { type: 'data'; id: string; generation: number; seq: number; data: string }
export type GitChangeKind = 'modified' | 'added' | 'deleted' | 'renamed' | 'untracked' | 'conflicted'
export interface GitLineStats { insertions?: number; deletions?: number; binary: boolean }
export interface GitFileChange {
  path: string
  oldPath?: string
  status: GitChangeKind
  /** Staged part (index vs HEAD). */
  indexStatus?: GitChangeKind
  /** Unstaged part (working tree vs index). */
  worktreeStatus?: GitChangeKind
  staged: boolean
  unstaged: boolean
  stagedStats?: GitLineStats
  unstagedStats?: GitLineStats
}
export type GitOperation = 'merge' | 'rebase' | 'cherry-pick' | 'revert'
export interface GitRepoStatus {
  isRepo: boolean; root?: string; branch?: string; detached?: boolean; hasHead?: boolean
  upstream?: string; ahead?: number; behind?: number; operation?: GitOperation
  changes: GitFileChange[]; truncated?: boolean
}
export type GitDiffArea = 'staged' | 'unstaged'
export interface GitDiff { path: string; area: GitDiffArea; untracked: boolean; binary: boolean; tooLarge: boolean; patch: string }
export interface GitBranch { name: string; current: boolean; upstream?: string; date?: string }
export interface GitRemoteBranch { name: string; localName: string; date?: string }
export interface GitBranches { current?: string; local: GitBranch[]; remote: GitRemoteBranch[] }
export interface GitSwitchOptions { create?: boolean; stash?: boolean }
export interface WorkspaceAPI {
  list(): Promise<Session[]>
  create(): Promise<Session>
  snapshot(id: string): Promise<Snapshot>
  input(id: string, data: string): Promise<void>
  resize(id: string, cols: number, rows: number): Promise<void>
  close(id: string): Promise<boolean>
  stop(id: string): Promise<void>
  restart(id: string): Promise<Session>
  folder(): Promise<string>
  chooseFolder(): Promise<string>
  onEvent(callback: (event: SessionEvent) => void): () => void
  gitStatus(id: string): Promise<GitRepoStatus>
  gitDiff(id: string, path: string, area: GitDiffArea): Promise<GitDiff>
  gitStage(id: string, path: string): Promise<void>
  gitUnstage(id: string, path: string): Promise<void>
  gitStageAll(id: string): Promise<void>
  gitUnstageAll(id: string): Promise<void>
  gitDiscard(id: string, path: string): Promise<void>
  gitCommit(id: string, message: string): Promise<{ hash: string }>
  gitCommitModels(): Promise<string[]>
  gitGenerateMessage(id: string, model: string): Promise<string>
  gitBranches(id: string): Promise<GitBranches>
  gitSwitch(id: string, branch: string, options: GitSwitchOptions): Promise<{ stashed: boolean }>
}
declare global { interface Window { workspace: WorkspaceAPI } }
