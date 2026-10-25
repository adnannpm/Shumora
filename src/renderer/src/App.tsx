import { useEffect, useState } from 'react'
import { Button } from '@chakra-ui/react'
import type { Session } from '../../shared/types'
import { TerminalPane } from './TerminalPane'

export default function App() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [active, setActive] = useState('')
  const [split, setSplit] = useState(false)
  const [secondaryId, setSecondaryId] = useState('')
  const [folder, setFolder] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    let disposed = false
    const load = async () => {
      try {
        const [list, cwd] = await Promise.all([window.workspace.list(), window.workspace.folder()])
        if (disposed) return
        setSessions(list); setFolder(cwd); setActive((id) => id || list[0]?.id || '')
      } catch (e) { if (!disposed) setError(String(e)) }
    }
    const unsubscribe = window.workspace.onEvent((event) => {
      if (event.type !== 'state') return
      setSessions((list) => list.some((s) => s.id === event.session.id) ? list.map((s) => s.id === event.session.id ? event.session : s) : [...list, event.session])
    })
    void load()
    return () => { disposed = true; unsubscribe() }
  }, [])
  async function add() {
    setBusy(true); setError('')
    try {
      const session = await window.workspace.create()
      setSessions((list) => list.some((s) => s.id === session.id) ? list.map((s) => s.id === session.id ? session : s) : [...list, session])
      if (split) setSecondaryId(active)
      setActive(session.id)
    } catch (e) { setError(String(e)) } finally { setBusy(false) }
  }
  const selected = sessions.find((s) => s.id === active)
  const secondary = split ? sessions.find((s) => s.id === secondaryId && s.id !== active) : undefined
  function select(id: string) {
    if (split && id === secondaryId) setSecondaryId(active)
    else if (split && id !== active) setSecondaryId(active)
    setActive(id)
  }
  function enableSplit() {
    if (!split) setSecondaryId(sessions.find((s) => s.id !== active)?.id || '')
    setSplit(true)
  }
  return <div className="workspace flex h-dvh overflow-hidden">
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark" aria-hidden="true">S<span>_</span></span><div>Shumora<small>Pi terminal workspace</small></div></div>
      <div className="section-label">Working directory</div>
      <button className="folder-button" aria-label="Choose folder for new sessions" onClick={() => { void window.workspace.chooseFolder().then(setFolder).catch((e) => setError(String(e))) }}><span>▱</span><span title={folder}>{folder || 'Loading folder…'}</span><span>↗</span></button>
      <p className="folder-help">Folder for new sessions</p>
      <div className="session-heading"><span className="section-label">Sessions</span><span className="count">{sessions.length}</span></div>
      <Button colorPalette="brand" size="sm" width="full" justifyContent="flex-start" borderRadius="4px" my="3" mb="4" loading={busy} loadingText="Starting…" disabled={busy} onClick={() => void add()}>＋ New session</Button>
      <nav aria-label="Pi sessions">{sessions.map((s) => <button key={s.id} className={`session-item ${active === s.id ? 'selected' : ''}`} onClick={() => select(s.id)} aria-pressed={active === s.id}>
        <span className={`status-dot ${s.status}`} /><span className="session-copy">{s.name}<small>{s.status === 'running' ? 'Process running' : s.status === 'error' ? 'Launch failed' : 'Process exited'}</small></span><span className="terminal-glyph">›_</span>
      </button>)}</nav>
      <div className="sidebar-footer"><span className="runtime-label">Pi Coding Agent</span><small>Local runtime · independent processes</small></div>
    </aside>
    <main className="flex min-w-0 flex-1 flex-col">
      <header className="toolbar"><div className="workspace-location"><span className="toolbar-label">Workspace</span><span className="breadcrumb-separator" aria-hidden="true">/</span><h1>{selected?.name || 'Starting workspace'}</h1></div><div className="layout-switch" aria-label="Terminal layout"><Button size="xs" variant={!split ? 'outline' : 'ghost'} colorPalette="brand" aria-label="Single view" aria-pressed={!split} onClick={() => setSplit(false)}>▣ <span>Single</span></Button><Button size="xs" variant={split ? 'outline' : 'ghost'} colorPalette="brand" aria-label="Split view" aria-pressed={split} onClick={enableSplit}>◫ <span>Split</span></Button></div></header>
      {error && <div className="global-error" role="alert">{error}<Button size="xs" variant="ghost" colorPalette="red" onClick={() => setError('')}>Dismiss</Button></div>}
      <div className={`terminal-grid grid min-h-0 flex-1 ${secondary ? 'grid-cols-2' : 'grid-cols-1'}`}>
        {sessions.map((session) => <TerminalPane key={session.id} session={session} visible={session.id === active || session.id === secondary?.id} focused={session.id === active} onFocus={() => select(session.id)} />)}
        {sessions.length === 0 && <div className="empty-state">Connecting to the local Pi runtime…</div>}
      </div>
      <footer className="statusbar"><span>{sessions.filter((s) => s.status === 'running').length} processes running</span><span>{secondary ? 'Split view' : 'Single view'} · Hidden sessions keep running</span></footer>
    </main>
  </div>
}
