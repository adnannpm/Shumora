import { useEffect, useState } from 'react'
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
  return <div className="workspace">
    <aside className="sidebar">
      <div className="brand"><span className="brand-icon">π</span><div>Pi Workspace<small>YOUR AGENT WORKBENCH</small></div></div>
      <div className="section-label">WORKSPACE</div>
      <button className="folder-button" aria-label="Choose folder for new sessions" onClick={() => { void window.workspace.chooseFolder().then(setFolder).catch((e) => setError(String(e))) }}><span>▱</span><span title={folder}>{folder || 'Loading folder…'}</span><span>↗</span></button>
      <p className="folder-help">Folder for new sessions</p>
      <div className="session-heading"><span className="section-label">SESSIONS</span><span className="count">{sessions.length}</span></div>
      <button className="new-session" onClick={() => void add()} disabled={busy}>＋ {busy ? 'Starting…' : 'New session'}</button>
      <nav aria-label="Pi sessions">{sessions.map((s) => <button key={s.id} className={`session-item ${active === s.id ? 'selected' : ''}`} onClick={() => select(s.id)} aria-pressed={active === s.id}>
        <span className={`status-dot ${s.status}`} /><span className="session-copy">{s.name}<small>{s.status === 'running' ? 'Process running' : s.status === 'error' ? 'Launch failed' : 'Process exited'}</small></span><span className="terminal-glyph">›_</span>
      </button>)}</nav>
      <div className="sidebar-footer"><span className="status-dot running" /> Local workspace<small>Independent sessions · installed Pi runtime</small></div>
    </aside>
    <main>
      <header className="toolbar"><div><span className="eyebrow">TERMINAL WORKSPACE</span><h1>{selected?.name || 'Starting workspace'}</h1></div><div className="layout-switch" aria-label="Terminal layout"><button aria-label="Single view" aria-pressed={!split} onClick={() => setSplit(false)}>▣ <span>Single</span></button><button aria-label="Split view" aria-pressed={split} onClick={enableSplit}>◫ <span>Split</span></button></div></header>
      {error && <div className="global-error" role="alert">{error}<button onClick={() => setError('')}>Dismiss</button></div>}
      <div className={`terminal-grid ${secondary ? 'split' : ''}`}>
        {sessions.map((session) => <TerminalPane key={session.id} session={session} visible={session.id === active || session.id === secondary?.id} focused={session.id === active} onFocus={() => select(session.id)} />)}
        {sessions.length === 0 && <div className="empty-state">Connecting to the local Pi runtime…</div>}
      </div>
      <footer className="statusbar"><span>{sessions.filter((s) => s.status === 'running').length} processes running</span><span>{secondary ? 'Split view' : 'Single view'} · Hidden sessions keep running</span></footer>
    </main>
  </div>
}
