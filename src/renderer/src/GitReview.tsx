import { AppCheckbox } from './AppCheckbox'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button, Dialog, Portal } from '@chakra-ui/react'
import type { GitBranches, GitCommitSummary, GitDiff, GitDiffArea, GitFileChange, GitPushInfo, GitRepoStatus, Session } from '../../shared/types'

const POLL_MS = 4000
const MODEL_KEY = 'shumora.commitModel'
const MARK: Record<GitFileChange['status'], string> = { modified: 'M', added: 'A', deleted: 'D', renamed: 'R', untracked: 'U', conflicted: '!' }

export interface DiffRow { kind: 'hunk' | 'context' | 'change'; left?: { no: number; text: string; removed: boolean }; right?: { no: number; text: string; added: boolean }; text?: string }

/** Converts a unified diff into side-by-side rows, pairing removed and added lines within each block. */
export function toRows(patch: string): DiffRow[] {
  const rows: DiffRow[] = []
  let oldNo = 0, newNo = 0, removed: string[] = [], added: string[] = []
  const flush = () => {
    for (let i = 0; i < Math.max(removed.length, added.length); i++) {
      rows.push({ kind: 'change', left: i < removed.length ? { no: ++oldNo, text: removed[i], removed: true } : undefined, right: i < added.length ? { no: ++newNo, text: added[i], added: true } : undefined })
    }
    removed = []; added = []
  }
  let inHunk = false
  for (const line of patch.split('\n')) {
    const hunk = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@(.*)$/.exec(line)
    if (hunk) { flush(); oldNo = Number(hunk[1]) - 1; newNo = Number(hunk[2]) - 1; inHunk = true; rows.push({ kind: 'hunk', text: line }); continue }
    if (!inHunk) continue
    if (line.startsWith('-')) removed.push(line.slice(1))
    else if (line.startsWith('+')) added.push(line.slice(1))
    else if (line.startsWith(' ')) { flush(); rows.push({ kind: 'context', left: { no: ++oldNo, text: line.slice(1), removed: false }, right: { no: ++newNo, text: line.slice(1), added: false } }) }
    else if (line.startsWith('diff --git')) { flush(); inHunk = false }
  }
  flush()
  return rows
}

/** Running sessions other than `self` whose folder is inside the repository. */
export function sessionsInRepo(sessions: Session[], root: string | undefined, self: string) {
  if (!root) return []
  const prefix = root.endsWith('/') || root.endsWith('\\') ? root : `${root}/`
  return sessions.filter((s) => s.id !== self && s.status === 'running' && (s.cwd === root || s.cwd.replace(/\\/g, '/').startsWith(prefix.replace(/\\/g, '/'))))
}

function useGitStatus(sessionId: string, active: boolean) {
  const [status, setStatus] = useState<GitRepoStatus>()
  const [error, setError] = useState('')
  const refresh = useCallback(async () => {
    try { setStatus(await window.workspace.gitStatus(sessionId)); setError('') } catch (e) { setError(String(e)) }
  }, [sessionId])
  useEffect(() => {
    if (!active) return
    void refresh()
    // Poll only while the workspace is shown and the window is in the foreground.
    const timer = setInterval(() => { if (!document.hidden) void refresh() }, POLL_MS)
    const onFocus = () => void refresh()
    window.addEventListener('focus', onFocus)
    return () => { clearInterval(timer); window.removeEventListener('focus', onFocus) }
  }, [active, refresh])
  return { status, error, refresh }
}

const lines = (changes: GitFileChange[], key: 'insertions' | 'deletions') =>
  changes.reduce((n, c) => n + (c.stagedStats?.[key] ?? 0) + (c.unstagedStats?.[key] ?? 0), 0)

/** Workspace toolbar control for the focused session's repo: branch switcher plus review dialog. */
export function GitReviewButton({ sessionId, sessionName, visible, sessions = [] }: { sessionId: string; sessionName?: string; visible: boolean; sessions?: Session[] }) {
  const [open, setOpen] = useState<'review' | 'branch'>()
  const { status, error, refresh } = useGitStatus(sessionId, visible || !!open)
  if (!status?.isRepo) return <div className="git-control" role="group" aria-label="Source control">
    <Button size="xs" variant="outline" className="git-button" disabled={!error} onClick={() => void refresh()} title={error || 'Open a terminal in a Git repository to review changes'}>
      <span aria-hidden>⎇</span> {error ? 'Retry Git status' : status ? 'Not a Git repository' : 'Loading Git…'}
    </Button>
    {error && <span role="alert" className="git-status-error">{error}</span>}
  </div>
  const count = status.changes.length
  const scope = sessionName ? ` (${sessionName})` : ''
  const branchLabel = status.detached ? 'HEAD (detached)' : status.branch ?? 'git'
  return <div className="git-control" role="group" aria-label="Source control">
    <Button size="xs" variant="outline" className="git-button" onClick={() => setOpen('branch')} title={`Switch branch${scope}`}>
      <span aria-hidden>⎇</span> <span className="git-branch-name">{branchLabel}</span>{!!status.ahead && <span className="git-count">↑{status.ahead}</span>}<span aria-hidden className="git-caret">▾</span>
    </Button>
    <Button size="xs" variant="outline" className={`git-button ${count ? 'dirty' : ''}`} onClick={() => setOpen('review')} title={(count ? `Review ${count} changed file${count === 1 ? '' : 's'}` : 'Working tree clean') + scope}>
      {count > 0 ? <span className="git-count">{count} · <span className="git-plus">+{lines(status.changes, 'insertions')}</span> <span className="git-minus">−{lines(status.changes, 'deletions')}</span></span> : <span className="git-clean">clean</span>}
    </Button>
    {open === 'review' && <GitReviewDialog sessionId={sessionId} status={status} error={error} refresh={refresh} onClose={() => setOpen(undefined)} />}
    {open === 'branch' && <BranchDialog sessionId={sessionId} status={status} others={sessionsInRepo(sessions, status.root, sessionId)} self={sessions.find((s) => s.id === sessionId)} refresh={refresh} onClose={() => setOpen(undefined)} />}
  </div>
}

interface Selection { path: string; area: GitDiffArea }

function GitReviewDialog({ sessionId, status, error, refresh, onClose }: { sessionId: string; status: GitRepoStatus; error: string; refresh: () => Promise<void>; onClose: () => void }) {
  const staged = status.changes.filter((c) => c.staged)
  const unstaged = status.changes.filter((c) => c.unstaged)
  const [selected, setSelected] = useState<Selection>()
  const [diff, setDiff] = useState<GitDiff>()
  const [actionError, setActionError] = useState('')
  const [busy, setBusy] = useState(false)
  const [pushOpen, setPushOpen] = useState(false)
  const [confirm, setConfirm] = useState<GitFileChange>()
  const [checkedStaged, setCheckedStaged] = useState<Set<string>>(new Set())
  const [checkedUnstaged, setCheckedUnstaged] = useState<Set<string>>(new Set())
  const request = useRef(0)

  const validCheckedStaged = useMemo(() => {
    const paths = new Set(staged.map((c) => c.path))
    return new Set([...checkedStaged].filter((p) => paths.has(p)))
  }, [staged, checkedStaged])

  const validCheckedUnstaged = useMemo(() => {
    const paths = new Set(unstaged.map((c) => c.path))
    return new Set([...checkedUnstaged].filter((p) => paths.has(p)))
  }, [unstaged, checkedUnstaged])

  const toggleStaged = (path: string) => {
    setCheckedStaged((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  const toggleAllStaged = () => {
    if (validCheckedStaged.size === staged.length) setCheckedStaged(new Set())
    else setCheckedStaged(new Set(staged.map((c) => c.path)))
  }

  const toggleUnstaged = (path: string) => {
    setCheckedUnstaged((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  const toggleAllUnstaged = () => {
    if (validCheckedUnstaged.size === unstaged.length) setCheckedUnstaged(new Set())
    else setCheckedUnstaged(new Set(unstaged.map((c) => c.path)))
  }

  // Keep the selection valid as files move between sections; fall back to the first available file.
  const valid = (s?: Selection) => !!s && (s.area === 'staged' ? staged : unstaged).some((c) => c.path === s.path)
  const current: Selection | undefined = valid(selected) ? selected
    : selected && valid({ path: selected.path, area: selected.area === 'staged' ? 'unstaged' : 'staged' }) ? { path: selected.path, area: selected.area === 'staged' ? 'unstaged' : 'staged' }
    : unstaged[0] ? { path: unstaged[0].path, area: 'unstaged' } : staged[0] ? { path: staged[0].path, area: 'staged' } : undefined
  const change = current && status.changes.find((c) => c.path === current.path)
  const key = current ? `${current.area}:${current.path}` : ''

  const load = useCallback(async (sel: Selection) => {
    const id = ++request.current
    try { const result = await window.workspace.gitDiff(sessionId, sel.path, sel.area); if (id === request.current) setDiff(result) }
    catch (e) { if (id === request.current) { setDiff(undefined); setActionError(String(e)) } }
  }, [sessionId])
  // Each successful status refresh can represent new content, even when line
  // counts are unchanged (or absent for untracked files).
  useEffect(() => { if (current) void load(current); else setDiff(undefined) }, [key, status, load])

  async function act(run: () => Promise<unknown>) {
    setBusy(true); setActionError('')
    try { await run(); await refresh() } catch (e) { setActionError(String(e)) } finally { setBusy(false); setConfirm(undefined) }
  }
  const ws = window.workspace

  return <Dialog.Root open onOpenChange={({ open }) => { if (!open) onClose() }} placement="center" size="cover" scrollBehavior="inside">
    <Portal><Dialog.Backdrop /><Dialog.Positioner><Dialog.Content className="git-review">
      <Dialog.Header className="git-review-header">
        <Dialog.Title>Source control <span className="git-branch">⎇ {status.detached ? 'HEAD (detached)' : status.branch}{status.operation ? ` · ${status.operation} in progress` : ''}</span></Dialog.Title>
        <div className="git-review-actions">
          {status.lastCommit && (
            <div className="git-last-commit" title={`Latest commit: ${status.lastCommit.hash} · ${status.lastCommit.subject} (${status.lastCommit.date})`}>
              <span className="git-last-commit-icon" aria-hidden="true">⦿</span>
              <span className="git-last-commit-hash">{status.lastCommit.hash}</span>
              <span className="git-last-commit-subject">{status.lastCommit.subject}</span>
            </div>
          )}
          <Button size="xs" variant="outline" className={`git-push-action ${status.ahead ? 'git-action-primary' : ''}`} disabled={busy || status.detached || !!status.operation} onClick={() => setPushOpen(true)} title={status.ahead ? `git push (${status.ahead} commit${status.ahead > 1 ? 's' : ''} to ${status.upstream || 'remote'})` : 'git push'}>
            <svg className="git-action-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V4m-4 4 4-4 4 4M5 15v5h14v-5" /></svg><span>git push</span>{!!status.ahead && <span className="git-push-count">{status.ahead}</span>}
          </Button>
          <Button className="git-refresh-action" size="xs" variant="ghost" disabled={busy} onClick={() => void refresh()} title="Refresh changes"><svg className="git-action-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5" /><path d="M6 7a7 7 0 0 1 11-1l3 6M4 12l3 6a7 7 0 0 0 11-1" /></svg><span>Refresh</span></Button>
          <Dialog.CloseTrigger asChild><Button className="git-close-action" size="xs" variant="ghost" aria-label="Close" title="Close"><svg className="git-action-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg></Button></Dialog.CloseTrigger>
        </div>
      </Dialog.Header>
      <Dialog.Body className="git-review-body">
        {(error || actionError) && <div className="terminal-error" role="alert">{error || actionError}</div>}
        <div className="git-layout">
          <div className="git-sidebar">
            <div className="git-files">
              <FileSection
                title="Staged changes"
                area="staged"
                changes={staged}
                current={current}
                checked={validCheckedStaged}
                onSelect={setSelected}
                onToggle={toggleStaged}
                onToggleAll={toggleAllStaged}
                action={staged.length ? (
                  <Button
                    size="2xs"
                    variant="ghost"
                    className={validCheckedStaged.size ? 'git-action-primary' : ''}
                    disabled={busy}
                    onClick={() => {
                      if (validCheckedStaged.size > 0) {
                        const paths = Array.from(validCheckedStaged)
                        setCheckedStaged(new Set())
                        void act(() => ws.gitUnstage(sessionId, paths))
                      } else {
                        void act(() => ws.gitUnstageAll(sessionId))
                      }
                    }}
                    title={validCheckedStaged.size ? `git restore --staged (${validCheckedStaged.size} selected)` : 'git restore --staged . (Unstage all)'}
                  >
                    {validCheckedStaged.size ? `git restore --staged (${validCheckedStaged.size})` : 'git restore --staged .'}
                  </Button>
                ) : null}
              />
              <FileSection
                title="Changes"
                area="unstaged"
                changes={unstaged}
                current={current}
                checked={validCheckedUnstaged}
                onSelect={setSelected}
                onToggle={toggleUnstaged}
                onToggleAll={toggleAllUnstaged}
                action={unstaged.length ? (
                  <Button
                    size="2xs"
                    variant="ghost"
                    className={validCheckedUnstaged.size ? 'git-action-primary' : ''}
                    disabled={busy}
                    onClick={() => {
                      if (validCheckedUnstaged.size > 0) {
                        const paths = Array.from(validCheckedUnstaged)
                        setCheckedUnstaged(new Set())
                        void act(() => ws.gitStage(sessionId, paths))
                      } else {
                        void act(() => ws.gitStageAll(sessionId))
                      }
                    }}
                    title={validCheckedUnstaged.size ? `git add (${validCheckedUnstaged.size} selected)` : 'git add . (Stage all)'}
                  >
                    {validCheckedUnstaged.size ? `git add (${validCheckedUnstaged.size})` : 'git add .'}
                  </Button>
                ) : null}
              />
              {status.truncated && <p className="git-note">Showing the first {status.changes.length} files.</p>}
            </div>
            <CommitBox sessionId={sessionId} stagedCount={staged.length} blocked={status.changes.some((c) => c.status === 'conflicted')} refresh={refresh} />
          </div>
          {!change || !current ? <div className="git-empty">Working tree clean. No changes to review.</div> : <section className="git-diff" aria-label={`Diff of ${current.path}`}>
            <div className="git-diff-toolbar">
              <span className="git-path" title={current.path}>{change.oldPath && current.area === 'staged' ? `${change.oldPath} → ` : ''}{current.path}</span>
            </div>
            <DiffView diff={diff?.path === current.path && diff.area === current.area ? diff : undefined} area={current.area} conflicted={change.status === 'conflicted'} />
          </section>}
        </div>
      </Dialog.Body>
    </Dialog.Content></Dialog.Positioner></Portal>
    <Dialog.Root role="alertdialog" open={!!confirm} placement="center" size="sm" closeOnInteractOutside={false} onOpenChange={({ open }) => { if (!open && !busy) setConfirm(undefined) }}>
      <Portal><Dialog.Backdrop /><Dialog.Positioner><Dialog.Content className="git-confirm">
        <Dialog.Header><Dialog.Title>git restore {confirm?.path}?</Dialog.Title></Dialog.Header>
        <Dialog.Body><Dialog.Description>{confirm?.status === 'untracked'
          ? 'This new file will be moved to the system trash.'
          : confirm?.staged ? 'Unstaged edits are lost. The file returns to its staged version; staged changes are kept.'
          : 'Unstaged edits are lost. The file returns to its last committed version.'}</Dialog.Description></Dialog.Body>
        <Dialog.Footer>
          <Button variant="outline" disabled={busy} onClick={() => setConfirm(undefined)}>Cancel</Button>
          <Button className="git-action-danger" loading={busy} onClick={() => { const c = confirm; if (c) void act(() => ws.gitDiscard(sessionId, c.path)) }}>git restore</Button>
        </Dialog.Footer>
      </Dialog.Content></Dialog.Positioner></Portal>
    </Dialog.Root>
    {pushOpen && <PushDialog sessionId={sessionId} status={status} refresh={refresh} onClose={() => setPushOpen(false)} />}
  </Dialog.Root>
}

function FileSection({
  title,
  area,
  changes,
  current,
  checked,
  onSelect,
  onToggle,
  onToggleAll,
  action
}: {
  title: string
  area: GitDiffArea
  changes: GitFileChange[]
  current?: Selection
  checked: Set<string>
  onSelect: (s: Selection) => void
  onToggle: (path: string) => void
  onToggleAll: () => void
  action: React.ReactNode
}) {
  const allChecked = changes.length > 0 && checked.size === changes.length
  return <section className="git-section" aria-label={title}>
    <header>
      <AppCheckbox
        aria-label={`Select all in ${title}`}
        checked={allChecked}
        disabled={!changes.length}
        onCheckedChange={onToggleAll}
        title={allChecked ? 'Deselect all' : 'Select all'}
      />
      <span>{title}</span>
      <span className="git-badge">{changes.length}</span>
      <span className="git-spacer" />
      {action}
    </header>
    {!changes.length ? <p className="git-section-empty">{area === 'staged' ? 'Nothing staged yet.' : 'No unstaged changes.'}</p> : <ul>
      {changes.map((c) => {
        const kind = (area === 'staged' ? c.indexStatus : c.worktreeStatus) ?? c.status
        const s = area === 'staged' ? c.stagedStats : c.unstagedStats
        const active = current?.path === c.path && current.area === area
        const isChecked = checked.has(c.path)
        return <li key={c.path} className={`git-file-item ${active ? 'active' : ''}`}>
          <AppCheckbox
            aria-label={`Select ${c.path} in ${title}`}
            checked={isChecked}
            onCheckedChange={() => onToggle(c.path)}
          />
          <button
            type="button"
            className="git-file-btn"
            aria-current={active || undefined}
            onClick={() => onSelect({ path: c.path, area })}
            title={c.oldPath ? `${c.oldPath} → ${c.path}` : c.path}
          >
            <span className={`git-mark ${kind}`} title={kind}>{MARK[kind]}</span>
            <span className="git-path">{c.path}</span>
            {s?.insertions !== undefined && <span className="git-stat"><span className="git-plus">+{s.insertions}</span> <span className="git-minus">−{s.deletions}</span></span>}
          </button>
        </li>
      })}
    </ul>}
  </section>
}

function CommitBox({ sessionId, stagedCount, blocked, refresh }: { sessionId: string; stagedCount: number; blocked: boolean; refresh: () => Promise<void> }) {
  const [message, setMessage] = useState('')
  const [models, setModels] = useState<string[]>()
  const [model, setModel] = useState(() => { try { return window.localStorage.getItem(MODEL_KEY) ?? '' } catch { return '' } })
  const [modelError, setModelError] = useState('')
  const [state, setState] = useState<'idle' | 'generating' | 'committing'>('idle')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    let alive = true
    window.workspace.gitCommitModels().then((list) => { if (alive) { setModels(list); setModelError(list.length ? '' : 'No models available in 9router.') } })
      .catch((e) => { if (alive) { setModels([]); setModelError(e instanceof Error ? e.message : String(e)) } })
    return () => { alive = false }
  }, [])
  const chosen = models?.includes(model) ? model : models?.[0] ?? ''
  function pick(value: string) {
    setModel(value)
    try { window.localStorage.setItem(MODEL_KEY, value) } catch { /* The choice only lasts this session. */ }
  }

  async function generate() {
    setState('generating'); setError(''); setNotice('')
    try { setMessage(await window.workspace.gitGenerateMessage(sessionId, chosen)) } catch (e) { setError(String(e)) } finally { setState('idle') }
  }
  async function commit() {
    setState('committing'); setError(''); setNotice('')
    try { const { hash } = await window.workspace.gitCommit(sessionId, message); setMessage(''); setNotice(`Committed ${hash}`); await refresh() }
    catch (e) { setError(String(e)) } finally { setState('idle') }
  }
  const idle = state === 'idle'
  return <form className="git-commit" aria-label="Commit" onSubmit={(e) => { e.preventDefault(); if (idle && stagedCount && message.trim() && !blocked) void commit() }}>
    <textarea aria-label="Commit message" placeholder={stagedCount ? 'Commit message' : 'git add files to commit'} value={message} rows={3} maxLength={10_000} disabled={!idle}
      onChange={(e) => setMessage(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); e.currentTarget.form?.requestSubmit() } }} />
    <div className="git-commit-row">
      <select aria-label="Model for commit messages" value={chosen} disabled={!idle || !models?.length} onChange={(e) => pick(e.target.value)} title={modelError || 'Model used to write the message'}>
        {!models ? <option value="">Loading models…</option> : !models.length ? <option value="">9router unavailable</option> : models.map((m) => <option key={m} value={m}>{m}</option>)}
      </select>
      <Button size="xs" variant="outline" type="button" loading={state === 'generating'} disabled={!idle || !stagedCount || !chosen} onClick={() => void generate()}
        title={modelError || (stagedCount ? 'Write a message from the staged diff in this repository\'s style' : 'git add files first')}>Generate</Button>
    </div>
    <Button size="sm" className="git-action-primary" type="submit" width="full" loading={state === 'committing'} disabled={!idle || !stagedCount || !message.trim() || blocked}>
      git commit{stagedCount ? ` (${stagedCount} file${stagedCount === 1 ? '' : 's'})` : ''}
    </Button>
    <p className="git-hint">{modelError ? modelError : 'Generate creates a commit message from staged changes via 9router. Ctrl+Enter runs git commit.'}</p>
    {error && <p className="git-commit-error" role="alert">{error}</p>}
    {notice && <p className="git-commit-notice" role="status">{notice}</p>}
  </form>
}

function BranchDialog({ sessionId, status, others, self, refresh, onClose }: { sessionId: string; status: GitRepoStatus; others: Session[]; self?: Session; refresh: () => Promise<void>; onClose: () => void }) {
  const [branches, setBranches] = useState<GitBranches>()
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [pending, setPending] = useState<{ name: string; create: boolean }>()
  useEffect(() => { window.workspace.gitBranches(sessionId).then(setBranches).catch((e) => setError(String(e))) }, [sessionId])

  const q = query.trim().toLowerCase()
  const local = useMemo(() => branches?.local.filter((b) => b.name.toLowerCase().includes(q)) ?? [], [branches, q])
  const remote = useMemo(() => branches?.remote.filter((b) => b.name.toLowerCase().includes(q)) ?? [], [branches, q])
  const canCreate = !!query.trim() && !branches?.local.some((b) => b.name === query.trim())
  const dirty = status.changes.length > 0
  const affected = [...(self?.status === 'running' ? [self] : []), ...others]

  function choose(name: string, create = false) {
    if (!create && name === branches?.current) return onClose()
    // Confirm whenever files would change under the agent or uncommitted work is involved.
    if (dirty || affected.length) setPending({ name, create })
    else void run(name, create, false)
  }
  async function run(name: string, create: boolean, stash: boolean) {
    setBusy(true); setError('')
    try { await window.workspace.gitSwitch(sessionId, name, { create, stash }); await refresh(); onClose() }
    catch (e) { setError(String(e)); setPending(undefined) } finally { setBusy(false) }
  }

  return <Dialog.Root open onOpenChange={({ open }) => { if (!open && !busy) onClose() }} placement="top" size="md" scrollBehavior="inside">
    <Portal><Dialog.Backdrop /><Dialog.Positioner><Dialog.Content className="git-review git-branches">
      <Dialog.Header className="git-review-header">
        <Dialog.Title>{pending ? `Switch to ${pending.name}?` : 'Switch branch'}</Dialog.Title>
        <Dialog.CloseTrigger asChild><Button size="xs" variant="ghost" aria-label="Close" title="Close">✕</Button></Dialog.CloseTrigger>
      </Dialog.Header>
      <Dialog.Body className="git-branch-body">
        {error && <div className="terminal-error git-pre" role="alert">{error}</div>}
        {status.operation && <p className="git-warning">A {status.operation} is in progress. Finish or abort it before switching.</p>}
        {pending ? <div className="git-switch-confirm">
          {affected.length > 0 && <p className="git-warning">Files on disk will change under running Pi session{affected.length > 1 ? 's' : ''} {affected.map((s) => s.name).join(', ')}. Wait until the agent is idle, or it may keep editing with outdated context.</p>}
          {dirty && <p>You have {status.changes.length} uncommitted change{status.changes.length === 1 ? '' : 's'}. Bring them to <strong>{pending.name}</strong>, or stash them first? Git refuses to switch if bringing them would overwrite files.</p>}
          <div className="git-switch-actions">
            <Button size="sm" variant="outline" disabled={busy} onClick={() => setPending(undefined)}>Cancel</Button>
            {dirty && <Button size="sm" variant="outline" disabled={busy} onClick={() => void run(pending.name, pending.create, true)}>Stash and switch</Button>}
            <Button size="sm" className="git-action-primary" loading={busy} onClick={() => void run(pending.name, pending.create, false)}>{dirty ? 'Bring changes and switch' : 'Switch'}</Button>
          </div>
        </div> : <>
          <input className="git-search" aria-label="Search or create branch" placeholder="Search or create a branch" value={query} autoFocus onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !status.operation) { const exact = branches?.local.find((b) => b.name === query.trim()) ?? branches?.remote.find((b) => b.name === query.trim()); if (exact) choose(exact.name); else if (canCreate) choose(query.trim(), true) } }} />
          {!branches ? !error && <p className="git-note">Loading branches…</p> : <div className="git-branch-list">
            {canCreate && <button type="button" className="git-branch-item create" disabled={!!status.operation || busy} onClick={() => choose(query.trim(), true)}>＋ Create branch <strong>{query.trim()}</strong> from {status.detached ? 'HEAD' : status.branch}</button>}
            <BranchGroup title="Local">{local.map((b) => <button key={b.name} type="button" className={`git-branch-item ${b.current ? 'current' : ''}`} disabled={!!status.operation || busy} aria-current={b.current || undefined} onClick={() => choose(b.name)}>
              <span className="git-check" aria-hidden>{b.current ? '✓' : ''}</span><span className="git-branch-label">{b.name}</span><span className="git-branch-meta">{b.upstream ?? ''}{b.date ? ` · ${b.date}` : ''}</span>
            </button>)}</BranchGroup>
            {remote.length > 0 && <BranchGroup title="Remote">{remote.map((b) => <button key={b.name} type="button" className="git-branch-item" disabled={!!status.operation || busy} onClick={() => choose(b.name)}>
              <span className="git-check" aria-hidden /><span className="git-branch-label">{b.name}</span><span className="git-branch-meta">creates {b.localName}{b.date ? ` · ${b.date}` : ''}</span>
            </button>)}</BranchGroup>}
            {!local.length && !remote.length && !canCreate && <p className="git-note">No branches match.</p>}
          </div>}
        </>}
      </Dialog.Body>
    </Dialog.Content></Dialog.Positioner></Portal>
  </Dialog.Root>
}

function BranchGroup({ title, children }: { title: string; children: React.ReactNode[] }) {
  if (!children.length) return null
  return <div role="group" aria-label={`${title} branches`}><p className="git-group-title">{title}</p>{children}</div>
}

export function PushDialog({ sessionId, status, refresh, onClose }: { sessionId: string; status: GitRepoStatus; refresh: () => Promise<void>; onClose: () => void }) {
  const [branches, setBranches] = useState<GitBranches>()
  const [selectedBranch, setSelectedBranch] = useState(status.branch || '')
  const [info, setInfo] = useState<GitPushInfo>()
  const [loading, setLoading] = useState(true)
  const [pushing, setPushing] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    window.workspace.gitBranches(sessionId).then(setBranches).catch((e) => setError(String(e)))
  }, [sessionId])

  useEffect(() => {
    let alive = true
    setLoading(true)
    setError('')
    window.workspace.gitPushInfo(sessionId, selectedBranch || undefined)
      .then((data) => { if (alive) { setInfo(data); setLoading(false) } })
      .catch((e) => { if (alive) { setError(String(e)); setLoading(false) } })
    return () => { alive = false }
  }, [sessionId, selectedBranch])

  async function doPush() {
    setPushing(true)
    setError('')
    try {
      await window.workspace.gitPush(sessionId, { branch: selectedBranch, setUpstream: !info?.hasUpstream })
      onClose()
      void refresh()
    } catch (e) {
      setError(String(e))
    } finally {
      setPushing(false)
    }
  }

  const localBranches = branches?.local ?? (status.branch ? [{ name: status.branch, current: true }] : [])
  const commitCount = info?.commits.length ?? 0
  const canPush = !loading && !pushing && (commitCount > 0 || !info?.hasUpstream)

  return <Dialog.Root open onOpenChange={({ open }) => { if (!open && !pushing) onClose() }} placement="center" size="md" scrollBehavior="inside">
    <Portal><Dialog.Backdrop /><Dialog.Positioner><Dialog.Content className="git-review git-push-dialog">
      <Dialog.Header className="git-review-header">
        <Dialog.Title>Git push</Dialog.Title>
        <Dialog.CloseTrigger asChild><Button size="xs" variant="ghost" disabled={pushing} aria-label="Close" title="Close">✕</Button></Dialog.CloseTrigger>
      </Dialog.Header>
      <Dialog.Body className="git-push-body">
        {error && <div className="terminal-error git-pre" role="alert">{error}</div>}
        <div className="git-push-field">
          <label className="git-push-label" htmlFor="git-push-branch-select">Target branch</label>
          <div className="git-push-select-wrap">
            <select id="git-push-branch-select" className="git-push-select" aria-label="Target branch" value={selectedBranch} disabled={loading || pushing || !localBranches.length} onChange={(e) => setSelectedBranch(e.target.value)}>
              {localBranches.map((b) => <option key={b.name} value={b.name}>{b.name}{b.current ? ' (current)' : ''}</option>)}
            </select>
          </div>
        </div>
        {info && <div className="git-push-remote-target">
          <span className="git-push-target-text">
            {info.hasUpstream
              ? <>Pushing to upstream <strong>{info.upstream}</strong></>
              : <>Publishing as new branch to <strong>{info.remote || 'origin'}/{selectedBranch}</strong></>}
          </span>
        </div>}
        {info && info.behind > 0 && <div className="git-warning git-push-behind-alert" role="alert">
          ⚠️ Remote has <strong>{info.behind}</strong> commit{info.behind > 1 ? 's' : ''} that you do not have locally. Push may be rejected; pull changes first.
        </div>}
        <div className="git-push-commits-section">
          <div className="git-push-commits-header">
            <span>Commits to push</span>
            <span className="git-badge">{loading ? '…' : commitCount}</span>
          </div>
          {loading ? <p className="git-note">Loading commits…</p> : commitCount === 0 ? <p className="git-push-empty">No unpushed commits. Branch is up to date.</p> : <ul className="git-unpushed-list" role="list">
            {info?.commits.map((c) => <li key={c.hash} className="git-unpushed-item">
              <span className="git-commit-hash">{c.hash}</span>
              <span className="git-commit-subject" title={c.subject}>{c.subject}</span>
              <span className="git-commit-date">{c.date}</span>
            </li>)}
          </ul>}
        </div>
      </Dialog.Body>
      <Dialog.Footer className="git-push-footer">
        <Button size="sm" variant="outline" disabled={pushing} onClick={onClose}>Cancel</Button>
        <Button size="sm" className="git-action-primary" loading={pushing} disabled={!canPush} onClick={() => void doPush()}>
          {pushing ? 'Pushing to remote…' : commitCount > 0 ? `Push ${commitCount} commit${commitCount > 1 ? 's' : ''}` : 'Push'}
        </Button>
      </Dialog.Footer>
    </Dialog.Content></Dialog.Positioner></Portal>
  </Dialog.Root>
}

function DiffView({ diff, area, conflicted }: { diff?: GitDiff; area: GitDiffArea; conflicted: boolean }) {
  if (!diff) return <div className="git-note">Loading diff…</div>
  if (diff.binary) return <div className="git-note">Binary file changed. No text diff available.</div>
  if (diff.tooLarge) return <div className="git-note">Diff is larger than 512 KB and is not shown.</div>
  const rows = toRows(diff.patch)
  if (!rows.length) return <div className="git-note">No content changes (mode or rename only).</div>
  const [left, right] = diff.untracked ? ['Original (none)', 'Working tree'] : conflicted ? ['HEAD', 'Working tree (with conflict markers)'] : area === 'staged' ? ['HEAD', 'Staged'] : ['Staged / HEAD', 'Working tree']
  return <div className="git-table" role="table">
    <div className="git-row git-head" role="row"><span role="columnheader">{left}</span><span role="columnheader">{right}</span></div>
    {rows.map((row, i) => row.kind === 'hunk'
      ? <div key={i} className="git-row git-hunk" role="row"><span role="cell">{row.text}</span></div>
      : <div key={i} className="git-row" role="row">
        <span role="cell" className={`git-cell ${row.left?.removed ? 'removed' : ''} ${row.left ? '' : 'empty'}`}><i>{row.left?.no}</i><code>{row.left?.text}</code></span>
        <span role="cell" className={`git-cell ${row.right?.added ? 'added' : ''} ${row.right ? '' : 'empty'}`}><i>{row.right?.no}</i><code>{row.right?.text}</code></span>
      </div>)}
  </div>
}
